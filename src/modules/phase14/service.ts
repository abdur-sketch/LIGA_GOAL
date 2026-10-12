import { Prisma, type SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { db, rootDb } from "@/lib/db";
import { withPlatformDatabase, withTenantDatabase } from "@/lib/tenant-db";

export const featureKeys = [
  "competition.create", "competition.max_active", "club.max_per_competition",
  "player.max_per_competition", "member.max_active", "match.live",
  "statistics.advanced", "export.pdf", "export.excel", "content.news",
  "branding.organizer", "season.multiple", "support.priority",
] as const;
export type FeatureKey = (typeof featureKeys)[number];

export const metricKeys = ["competition.active", "member.active", "club.per_competition", "player.per_competition", "export.monthly"] as const;
export type MetricKey = (typeof metricKeys)[number];

const featureSchema = z.enum(featureKeys);
const planAssignmentSchema = z.object({
  organizationId: z.string().min(1), planCode: z.enum(["FREE", "TOURNAMENT", "PRO_LEAGUE", "ORGANIZER_PRO", "ENTERPRISE"]),
  version: z.number().int().positive().default(1), status: z.enum(["TRIAL", "ACTIVE", "GRACE_PERIOD", "PAST_DUE", "SUSPENDED", "CANCELED", "EXPIRED"]),
  reason: z.string().trim().min(8).max(500), trialDays: z.number().int().min(1).max(90).optional(),
});
const transitionSchema = z.object({ organizationId: z.string().min(1), action: z.enum(["EXTEND_TRIAL", "SUSPEND", "REACTIVATE", "EXPIRE", "CANCEL"]), reason: z.string().trim().min(8).max(500), days: z.number().int().min(1).max(90).optional() });

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function statusAt(subscription: { status: SubscriptionStatus; trialEndsAt: Date | null; currentPeriodEnd: Date | null; graceEndsAt: Date | null }, now = new Date()) {
  if (subscription.status === "TRIAL" && subscription.trialEndsAt && subscription.trialEndsAt <= now) return "EXPIRED" as const;
  if (subscription.status === "ACTIVE" && subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) return "EXPIRED" as const;
  if (subscription.status === "GRACE_PERIOD" && subscription.graceEndsAt && subscription.graceEndsAt <= now) return "EXPIRED" as const;
  return subscription.status;
}

export async function listPlanCatalog() {
  return db.plan.findMany({
    where: { isActive: true },
    include: { versions: { where: { isActive: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { features: { orderBy: { featureKey: "asc" } } }, orderBy: { version: "desc" }, take: 1 } },
    orderBy: { code: "asc" },
  });
}

async function subscriptionPlan(organizationId: string, competitionId?: string, seasonId?: string) {
  const now = new Date();
  if (competitionId) {
    const scoped = await db.competitionEntitlement.findFirst({
      where: { organizationId, competitionId, ...(seasonId ? { OR: [{ seasonId }, { seasonId: null }] } : { seasonId: null }), status: { in: ["TRIAL", "ACTIVE"] }, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { planVersion: { include: { plan: true, features: true } } }, orderBy: { endsAt: "desc" },
    });
    if (scoped) return { source: "COMPETITION" as const, subscription: null, planVersion: scoped.planVersion, status: scoped.status, validUntil: scoped.endsAt };
  }
  const subscription = await db.organizationSubscription.findUnique({ where: { organizationId }, include: { planVersion: { include: { plan: true, features: true } } } });
  if (subscription) return { source: "ORGANIZATION" as const, subscription, planVersion: subscription.planVersion, status: statusAt(subscription), validUntil: subscription.currentPeriodEnd ?? subscription.trialEndsAt ?? subscription.graceEndsAt };
  const fallback = await db.planVersion.findFirstOrThrow({ where: { plan: { code: "FREE" }, isActive: true }, include: { plan: true, features: true }, orderBy: { version: "desc" } });
  return { source: "FALLBACK_FREE" as const, subscription: null, planVersion: fallback, status: "ACTIVE" as const, validUntil: null };
}

export async function evaluateEntitlement(organizationId: string, rawFeatureKey: string, options: { competitionId?: string; seasonId?: string; operation?: "READ" | "WRITE" | "EXPORT" } = {}) {
  const featureKey = featureSchema.parse(rawFeatureKey);
  const organization = await db.organization.findFirst({ where: { id: organizationId, deletedAt: null }, select: { status: true } });
  if (!organization || organization.status !== "ACTIVE") return { allowed: false, featureKey, limit: null, value: null, reasonCode: "ORGANIZATION_INACTIVE", planCode: null, planVersion: null, source: "NONE", validUntil: null } as const;
  const resolved = await subscriptionPlan(organizationId, options.competitionId, options.seasonId);
  const operation = options.operation ?? "WRITE";
  const statusAllows = resolved.status === "ACTIVE" || resolved.status === "TRIAL" || (operation !== "WRITE" && ["GRACE_PERIOD", "PAST_DUE", "SUSPENDED", "CANCELED", "EXPIRED"].includes(resolved.status));
  const feature = resolved.planVersion.features.find((item) => item.featureKey === featureKey && (item.scope === "ORGANIZATION" || (options.seasonId && item.scope === "SEASON") || (options.competitionId && item.scope === "COMPETITION")));
  const allowed = statusAllows && Boolean(feature?.enabled);
  return { allowed, featureKey, limit: feature?.limit ?? null, value: feature?.value ?? null, reasonCode: !statusAllows ? `SUBSCRIPTION_${resolved.status}` : feature?.enabled ? "ALLOWED" : "FEATURE_NOT_INCLUDED", planCode: resolved.planVersion.plan.code, planVersion: resolved.planVersion.version, source: resolved.source, validUntil: resolved.validUntil };
}

export async function requireEntitlement(actor: ApiActor, organizationId: string, permission: Parameters<typeof authorizeOrganization>[2], featureKey: FeatureKey, options: { competitionId?: string; seasonId?: string; operation?: "READ" | "WRITE" | "EXPORT" } = {}) {
  await authorizeOrganization(actor, organizationId, permission);
  const decision = await evaluateEntitlement(organizationId, featureKey, options);
  if (!decision.allowed) throw new ApiError(402, "Fitur tidak tersedia pada paket atau status subscription saat ini.", decision);
  return decision;
}

function periodFor(metricKey: MetricKey) {
  if (metricKey !== "export.monthly") return { start: new Date("1970-01-01T00:00:00.000Z"), end: new Date("9999-12-31T23:59:59.999Z") };
  const now = new Date();
  return { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

export async function reserveQuotaInCurrentTransaction(input: { organizationId: string; metricKey: MetricKey; featureKey: FeatureKey; eventKey: string; scopeKey?: string; delta?: number; currentUsage: () => Promise<number>; competitionId?: string }) {
  const delta = input.delta ?? 1; const scopeKey = input.scopeKey ?? "organization";
  if (!/^[A-Za-z0-9:_-]{8,160}$/.test(input.eventKey) || delta <= 0) throw new ApiError(422, "Kunci idempotensi atau delta kuota tidak valid.");
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${input.organizationId}:${input.metricKey}:${scopeKey}`}))`;
  const committed = await db.usageEvent.findFirst({ where: { organizationId: input.organizationId, metricKey: input.metricKey, eventKey: input.eventKey, kind: "COMMIT" } });
  if (committed) return { duplicate: true, counterId: committed.counterId, limit: null };
  const decision = await evaluateEntitlement(input.organizationId, input.featureKey, { competitionId: input.competitionId, operation: "WRITE" });
  if (!decision.allowed) throw new ApiError(402, "Fitur tidak tersedia pada paket atau status subscription saat ini.", decision);
  const period = periodFor(input.metricKey); const used = await input.currentUsage();
  const counter = await db.usageCounter.upsert({
    where: { organizationId_metricKey_scopeKey_periodStart: { organizationId: input.organizationId, metricKey: input.metricKey, scopeKey, periodStart: period.start } },
    update: { used, version: { increment: 1 } }, create: { organizationId: input.organizationId, metricKey: input.metricKey, scopeKey, periodStart: period.start, periodEnd: period.end, used },
  });
  if (decision.limit !== null && used + counter.reserved + delta > decision.limit) throw new ApiError(409, "Kuota paket telah tercapai.", { metricKey: input.metricKey, used, reserved: counter.reserved, limit: decision.limit });
  await db.usageEvent.create({ data: { organizationId: input.organizationId, counterId: counter.id, metricKey: input.metricKey, scopeKey, eventKey: input.eventKey, kind: "RESERVE", delta } });
  await db.usageCounter.update({ where: { id: counter.id }, data: { reserved: { increment: delta }, version: { increment: 1 } } });
  return { duplicate: false, counterId: counter.id, limit: decision.limit };
}

export async function commitQuotaInCurrentTransaction(input: { organizationId: string; counterId: string; metricKey: MetricKey; eventKey: string; scopeKey?: string; delta?: number; resourceId?: string }) {
  const delta = input.delta ?? 1; const scopeKey = input.scopeKey ?? "organization";
  await db.usageEvent.create({ data: { organizationId: input.organizationId, counterId: input.counterId, metricKey: input.metricKey, scopeKey, eventKey: input.eventKey, kind: "COMMIT", delta, metadata: input.resourceId ? { resourceId: input.resourceId } : undefined } });
  await db.usageCounter.update({ where: { id: input.counterId }, data: { reserved: { decrement: delta }, used: { increment: delta }, version: { increment: 1 } } });
}

async function actualUsage(organizationId: string, metricKey: MetricKey, scopeKey = "organization") {
  if (metricKey === "competition.active") return db.competition.count({ where: { organizationId, deletedAt: null, status: { not: "ARCHIVED" } } });
  if (metricKey === "member.active") return db.organizationMember.count({ where: { organizationId, isActive: true } });
  if (metricKey === "club.per_competition") return db.competitionClub.count({ where: { organizationId, competitionId: scopeKey } });
  if (metricKey === "player.per_competition") return db.playerRegistration.count({ where: { organizationId, competitionId: scopeKey, status: { not: "REJECTED" } } });
  const period = periodFor(metricKey);
  return db.usageEvent.aggregate({ where: { organizationId, metricKey, kind: "COMMIT", createdAt: { gte: period.start, lt: period.end } }, _sum: { delta: true } }).then((row) => row._sum.delta ?? 0);
}

export async function billingSnapshot(actor: ApiActor, organizationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "organization.billing.view");
    const [resolved, catalog, counters] = await Promise.all([subscriptionPlan(organizationId), listPlanCatalog(), db.usageCounter.findMany({ where: { organizationId }, orderBy: { metricKey: "asc" } })]);
    const usage = await Promise.all([
      ["competition.active", "competition.max_active"], ["member.active", "member.max_active"],
    ].map(async ([metricKey, featureKey]) => ({ metricKey, used: await actualUsage(organizationId, metricKey as MetricKey), decision: await evaluateEntitlement(organizationId, featureKey) })));
    return { subscription: resolved.subscription, plan: { code: resolved.planVersion.plan.code, version: resolved.planVersion.version, displayName: resolved.planVersion.displayName, status: resolved.status, validUntil: resolved.validUntil }, features: resolved.planVersion.features, usage, counters, catalog };
  });
}

function assertPlatform(actor: ApiActor) { if (!actor.isPlatformAdmin) throw new ApiError(403, "Kontrol subscription hanya tersedia untuk platform admin."); }

export async function listPlatformSubscriptions(actor: ApiActor) {
  assertPlatform(actor);
  return withPlatformDatabase(rootDb, () => db.organizationSubscription.findMany({ include: { organization: { select: { id: true, name: true, slug: true } }, planVersion: { include: { plan: true } } }, orderBy: { updatedAt: "desc" } }));
}

export async function assignPlan(actor: ApiActor, raw: unknown) {
  assertPlatform(actor); const input = planAssignmentSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    const planVersion = await db.planVersion.findFirst({ where: { plan: { code: input.planCode, isActive: true }, version: input.version, isActive: true } });
    if (!planVersion) throw new ApiError(404, "Versi paket tidak ditemukan.");
    const before = await db.organizationSubscription.findUnique({ where: { organizationId: input.organizationId } });
    const now = new Date(); const trialEndsAt = input.status === "TRIAL" ? new Date(now.valueOf() + (input.trialDays ?? 14) * 86_400_000) : null;
    const subscription = await db.organizationSubscription.upsert({ where: { organizationId: input.organizationId }, update: { planVersionId: planVersion.id, status: input.status, trialEndsAt, assignedById: actor.id, reason: input.reason, suspendedAt: input.status === "SUSPENDED" ? now : null, version: { increment: 1 } }, create: { organizationId: input.organizationId, planVersionId: planVersion.id, status: input.status, trialEndsAt, assignedById: actor.id, reason: input.reason } });
    await db.subscriptionAudit.create({ data: { organizationId: input.organizationId, subscriptionId: subscription.id, actorId: actor.id, action: "ASSIGN_PLAN", reason: input.reason, before: before ? json(before) : Prisma.JsonNull, after: json(subscription) } });
    await db.auditLog.createMany({ data: [{ organizationId: input.organizationId, actorId: actor.id, action: "UPDATE", resourceType: "ORGANIZATION_SUBSCRIPTION", resourceId: subscription.id, before: before ? json(before) : Prisma.JsonNull, after: json(subscription) }] });
    return subscription;
  });
}

export async function transitionSubscription(actor: ApiActor, raw: unknown) {
  assertPlatform(actor); const input = transitionSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    const before = await db.organizationSubscription.findUnique({ where: { organizationId: input.organizationId } });
    if (!before) throw new ApiError(404, "Subscription tidak ditemukan.");
    const now = new Date(); const data: Prisma.OrganizationSubscriptionUpdateInput = { reason: input.reason, assignedBy: { connect: { id: actor.id } }, version: { increment: 1 } };
    if (input.action === "EXTEND_TRIAL") { data.status = "TRIAL"; data.trialEndsAt = new Date(Math.max(now.valueOf(), before.trialEndsAt?.valueOf() ?? 0) + (input.days ?? 14) * 86_400_000); }
    if (input.action === "SUSPEND") { data.status = "SUSPENDED"; data.suspendedAt = now; }
    if (input.action === "REACTIVATE") { data.status = "ACTIVE"; data.suspendedAt = null; data.canceledAt = null; }
    if (input.action === "EXPIRE") data.status = "EXPIRED";
    if (input.action === "CANCEL") { data.status = "CANCELED"; data.canceledAt = now; }
    const after = await db.organizationSubscription.update({ where: { id: before.id }, data });
    await db.subscriptionAudit.create({ data: { organizationId: input.organizationId, subscriptionId: before.id, actorId: actor.id, action: input.action, reason: input.reason, before: json(before), after: json(after) } });
    await db.auditLog.createMany({ data: [{ organizationId: input.organizationId, actorId: actor.id, action: "UPDATE", resourceType: "ORGANIZATION_SUBSCRIPTION", resourceId: before.id, before: json(before), after: json(after) }] });
    return after;
  });
}

export async function reconcileCounter(actor: ApiActor, organizationId: string, metricKey: MetricKey, scopeKey: string, reason: string) {
  assertPlatform(actor); if (reason.trim().length < 8) throw new ApiError(422, "Alasan rekonsiliasi wajib diisi.");
  return withTenantDatabase(rootDb, organizationId, async () => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`quota:${organizationId}:${metricKey}:${scopeKey}`}))`;
    const used = await actualUsage(organizationId, metricKey, scopeKey); const period = periodFor(metricKey);
    const before = await db.usageCounter.findUnique({ where: { organizationId_metricKey_scopeKey_periodStart: { organizationId, metricKey, scopeKey, periodStart: period.start } } });
    const counter = await db.usageCounter.upsert({ where: { organizationId_metricKey_scopeKey_periodStart: { organizationId, metricKey, scopeKey, periodStart: period.start } }, update: { used, reserved: 0, version: { increment: 1 } }, create: { organizationId, metricKey, scopeKey, periodStart: period.start, periodEnd: period.end, used } });
    const eventKey = `reconcile:${Date.now()}:${actor.id}`;
    await db.usageEvent.create({ data: { organizationId, counterId: counter.id, metricKey, scopeKey, eventKey, kind: "RECONCILE", delta: used - (before?.used ?? 0), metadata: { reason, actorId: actor.id } } });
    await db.auditLog.createMany({ data: [{ organizationId, actorId: actor.id, action: "UPDATE", resourceType: "USAGE_RECONCILIATION", resourceId: counter.id, before: before ? json(before) : Prisma.JsonNull, after: json(counter) }] });
    return counter;
  });
}
