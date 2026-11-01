import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { db, rootDb } from "@/lib/db";
import { withPlatformDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { requirePlatformPermission } from "@/modules/phase17/service";
import { privacyRequestSchema, retentionPreviewSchema } from "./validation";

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function secret() { const value = process.env.NEXTAUTH_SECRET; if (!value || value.length < 32) throw new Error("NEXTAUTH_SECRET diperlukan."); return value; }

export async function submitPrivacyRequest(raw: unknown) {
  const input = privacyRequestSchema.parse(raw);
  const requestToken = createHmac("sha256", secret()).update(`privacy:${input.registrationNumber}:${input.idempotencyKey}`).digest("base64url");
  try {
    const rows = await db.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT * FROM public.phase22_submit_privacy_request(
        ${randomUUID()}, ${input.registrationNumber}, ${digest(input.registrationToken)}, ${input.type}::"PrivacyRequestType",
        ${input.requesterEmail}, ${digest(input.requesterEmail)}, ${digest(requestToken)}, ${input.idempotencyKey}, ${input.description ?? null}
      )
    `);
    if (!rows[0]) throw new Error("Privacy request function returned no row.");
    return { requestId: rows[0].id, status: rows[0].status, token: requestToken };
  } catch (error) {
    if (error instanceof Error && error.message.includes("REGISTRATION_NOT_FOUND")) throw new ApiError(404, "Permintaan tidak dapat diverifikasi.");
    throw error;
  }
}

export async function recordSensitiveAccess(actor: ApiActor, organizationId: string, input: { resourceType: string; resourceId?: string; purpose: string; fieldSet: string[]; requestId?: string }) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "privacy.request.view");
    return db.sensitiveDataAccessLog.create({ data: { organizationId, actorId: actor.id, ...input } });
  });
}

export async function retentionPreview(actor: ApiActor, raw: unknown) {
  const input = retentionPreviewSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "privacy.request.manage");
    const [expired, requested, minors, pendingRequests] = await Promise.all([
      db.publicRegistration.count({ where: { organizationId: input.organizationId, anonymizedAt: null, retentionUntil: { lte: input.asOf } } }),
      db.publicRegistration.count({ where: { organizationId: input.organizationId, anonymizedAt: null, deletionRequestedAt: { not: null } } }),
      db.publicRegistration.count({ where: { organizationId: input.organizationId, isMinor: true, anonymizedAt: null } }),
      db.privacyDataRequest.count({ where: { organizationId: input.organizationId, status: { notIn: ["REJECTED", "COMPLETED"] } } }),
    ]);
    return { mode: "DRY_RUN_ONLY" as const, policyStatus: "PENDING_OWNER_APPROVAL" as const, asOf: input.asOf, expired, deletionRequested: requested, minors, pendingRequests };
  });
}

type GateStatus = "PASS" | "FAIL" | "BLOCKED" | "NOT VERIFIED";
type Gate = { status: GateStatus; evidence: string };

export async function releaseReadiness(actor: ApiActor) {
  return withPlatformDatabase(rootDb, async () => {
    await requirePlatformPermission(actor, "platform.operations.view");
    const started = performance.now();
    const [database, migrations, failedJobs, pendingJobs, privacyRequests] = await Promise.all([
      db.$queryRaw<Array<{ connections: bigint; max_connections: number; size_bytes: bigint }>>`
        SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()) AS connections,
          current_setting('max_connections')::int AS max_connections, pg_database_size(current_database()) AS size_bytes
      `,
      db.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC`,
      db.backgroundJob.count({ where: { status: { in: ["failed", "dead"] } } }),
      db.backgroundJob.count({ where: { status: "pending" } }),
      db.privacyDataRequest.count({ where: { status: { notIn: ["REJECTED", "COMPLETED"] } } }),
    ]);
    const latest = migrations[0]?.migration_name;
    const providerConfigured = Boolean(process.env.EMAIL_PROVIDER_ENDPOINT && process.env.ALERT_WEBHOOK_URL && process.env.S3_ENDPOINT && process.env.CLAMAV_HOST);
    const evidenceSha = process.env.RELEASE_SECURITY_EVIDENCE_SHA;
    const commitSha = process.env.APP_COMMIT_SHA;
    const gates: Record<string, Gate> = {
      migration: { status: migrations.length >= 35 && latest === "20261101160000_phase_22_privacy_readiness" ? "PASS" : "FAIL", evidence: `${migrations.length} migration; latest=${latest ?? "none"}` },
      database: { status: "PASS", evidence: `latency=${Math.round(performance.now() - started)}ms; connections=${database[0]?.connections ?? 0}/${database[0]?.max_connections ?? 0}` },
      security: evidenceSha && commitSha && evidenceSha === commitSha ? { status: "PASS", evidence: `signed evidence for ${commitSha.slice(0, 12)}` } : { status: "NOT VERIFIED", evidence: "No commit-bound security evidence configured." },
      monitoring: process.env.METRICS_TOKEN ? { status: "PASS", evidence: `Local metrics enabled; failedJobs=${failedJobs}; pendingJobs=${pendingJobs}` } : { status: "BLOCKED", evidence: "METRICS_TOKEN is not configured." },
      backup: { status: "BLOCKED", evidence: "No staging provider backup/restore evidence." },
      provider: providerConfigured ? { status: "NOT VERIFIED", evidence: "Provider variables exist but staging verification evidence is absent." } : { status: "BLOCKED", evidence: "External storage/scanner/email/alert providers are incomplete." },
      humanUat: { status: "BLOCKED", evidence: "Human sign-off is intentionally absent." },
      pilotOrganizer: { status: "BLOCKED", evidence: "No approved organizer pilot sign-off." },
      githubActions: { status: "BLOCKED", evidence: "Remote run 41291784188: account locked due to billing issue." },
    };
    return { gates, blockers: Object.entries(gates).filter(([, gate]) => gate.status !== "PASS").map(([key, gate]) => ({ key, ...gate })), operations: { failedJobs, pendingJobs, privacyRequests, databaseSizeBytes: Number(database[0]?.size_bytes ?? 0) }, generatedAt: new Date().toISOString() };
  });
}

export function randomPrivacyIdempotencyKey() { return randomBytes(18).toString("base64url"); }
