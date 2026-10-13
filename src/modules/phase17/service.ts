import { createHash } from "node:crypto";
import { Prisma, type AuditAction, type OrganizerVerificationStatus } from "@prisma/client";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { db, rootDb } from "@/lib/db";
import { withPlatformDatabase, withPublicDatabase, withTenantDatabase } from "@/lib/tenant-db";
import {
  abuseReportSchema,
  appealReviewSchema,
  moderationAppealSchema,
  moderationNoteSchema,
  moderationReviewSchema,
  organizationStateSchema,
  verificationReviewSchema,
  verificationSubmissionSchema,
} from "./validation";

function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
async function platform<T>(callback: () => Promise<T>) { return withPlatformDatabase(rootDb, callback); }
async function tenant<T>(organizationId: string, callback: () => Promise<T>) { return withTenantDatabase(rootDb, organizationId, callback); }

export async function requirePlatformPermission(actor: ApiActor, permission: string) {
  if (!actor.isPlatformAdmin) throw new ApiError(403, "Akses platform diperlukan.");
  const grant = await db.platformPermissionGrant.findUnique({ where: { userId_permission: { userId: actor.id, permission } }, select: { id: true } });
  if (!grant) throw new ApiError(403, "Permission platform eksplisit tidak tersedia.");
}

async function audit(actor: ApiActor, organizationId: string | null, action: AuditAction, resourceType: string, resourceId: string, before: unknown, after: unknown) {
  await db.auditLog.create({ data: { actorId: actor.id, organizationId, action, resourceType, resourceId, before: before == null ? undefined : json(before), after: after == null ? undefined : json(after) } });
}

export function sourceDigest(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function submitOrganizerVerification(actor: ApiActor, raw: unknown) {
  const input = verificationSubmissionSchema.parse(raw);
  return tenant(input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "organization.public_profile.manage");
    const existing = await db.organizerVerification.findUnique({ where: { organizationId: input.organizationId } });
    if (existing && !["UNVERIFIED", "REJECTED"].includes(existing.status)) throw new ApiError(409, "Verifikasi tidak dapat diajukan pada status saat ini.");
    const now = new Date();
    const record = existing
      ? await db.organizerVerification.update({ where: { id: existing.id }, data: { status: "PENDING_REVIEW", evidence: input.evidence, submittedAt: now, reviewedAt: null, reviewedById: null, reviewReason: null, version: { increment: 1 } } })
      : await db.organizerVerification.create({ data: { organizationId: input.organizationId, status: "PENDING_REVIEW", evidence: input.evidence, submittedAt: now } });
    await audit(actor, input.organizationId, "CREATE", "OrganizerVerification", record.id, existing, { status: record.status, submittedAt: record.submittedAt, version: record.version });
    return record;
  });
}

export const verificationQueue = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "organizer.verification.view");
  return db.organizerVerification.findMany({
    where: { status: { in: ["PENDING_REVIEW", "REJECTED", "SUSPENDED"] } },
    select: { id: true, status: true, submittedAt: true, reviewedAt: true, reviewReason: true, version: true, organization: { select: { id: true, name: true, slug: true, status: true } } },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }], take: 100,
  });
});

export async function reviewOrganizerVerification(actor: ApiActor, raw: unknown) {
  const input = verificationReviewSchema.parse(raw);
  return platform(async () => {
    await requirePlatformPermission(actor, "organizer.verification.manage");
    const before = await db.organizerVerification.findUnique({ where: { id: input.id } });
    if (!before) throw new ApiError(404, "Permohonan verifikasi tidak ditemukan.");
    if (input.action !== "suspend" && before.status !== "PENDING_REVIEW") throw new ApiError(409, "Permohonan tidak lagi menunggu review.");
    const status: OrganizerVerificationStatus = input.action === "verify" ? "VERIFIED" : input.action === "reject" ? "REJECTED" : "SUSPENDED";
    const changed = await db.organizerVerification.updateMany({ where: { id: input.id, version: input.version }, data: { status, reviewedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, "Data telah direview moderator lain. Muat ulang antrean.");
    const after = await db.organizerVerification.findUniqueOrThrow({ where: { id: input.id } });
    await audit(actor, before.organizationId, status === "VERIFIED" ? "APPROVE" : "REJECT", "OrganizerVerification", before.id, before, { ...after, evidence: "[REDACTED]" });
    return after;
  });
}

export async function submitAbuseReport(raw: unknown, requestFingerprint: string) {
  const input = abuseReportSchema.parse(raw);
  return withPublicDatabase(async () => {
    const target: { organizationId: string; competitionId: string | null } | null = input.targetType === "ORGANIZER"
      ? await db.publicOrganizerProfile.findFirst({ where: { id: input.targetId, status: "PUBLISHED", organization: { status: "ACTIVE" } }, select: { organizationId: true } }).then((item) => item ? { ...item, competitionId: null } : null)
      : await db.competitionPublication.findFirst({ where: { id: input.targetId, status: "PUBLISHED", organization: { status: "ACTIVE" } }, select: { organizationId: true, competitionId: true } });
    if (!target) throw new ApiError(404, "Konten publik tidak ditemukan.");
    const report = await db.abuseReport.create({ data: { organizationId: target.organizationId, competitionId: target.competitionId, targetType: input.targetType, category: input.category, description: input.description, reporterContact: input.reporterContact, sourceHash: sourceDigest(requestFingerprint) } });
    return { id: report.id, status: report.status, createdAt: report.createdAt };
  });
}

export const moderationQueue = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "abuse.moderate.view");
  return db.abuseReport.findMany({
    where: { status: { in: ["OPEN", "IN_REVIEW"] } },
    select: { id: true, targetType: true, category: true, description: true, status: true, version: true, createdAt: true, organization: { select: { id: true, name: true, slug: true, status: true } }, competition: { select: { id: true, name: true } }, notes: { select: { id: true, body: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100,
  });
});

export async function addModerationNote(actor: ApiActor, raw: unknown) {
  const input = moderationNoteSchema.parse(raw);
  return platform(async () => {
    await requirePlatformPermission(actor, "abuse.moderate.manage");
    const report = await db.abuseReport.findUnique({ where: { id: input.reportId }, select: { organizationId: true } });
    if (!report) throw new ApiError(404, "Laporan tidak ditemukan.");
    const note = await db.moderationNote.create({ data: { reportId: input.reportId, authorId: actor.id, body: input.body } });
    await audit(actor, report.organizationId, "CREATE", "ModerationNote", note.id, null, { reportId: input.reportId });
    return note;
  });
}

export async function reviewAbuseReport(actor: ApiActor, raw: unknown) {
  const input = moderationReviewSchema.parse(raw);
  return platform(async () => {
    await requirePlatformPermission(actor, "abuse.moderate.manage");
    const before = await db.abuseReport.findUnique({ where: { id: input.reportId } });
    if (!before) throw new ApiError(404, "Laporan tidak ditemukan.");
    if (["ACTIONED", "DISMISSED"].includes(before.status)) throw new ApiError(409, "Laporan sudah ditutup.");
    const nextStatus = input.action === "review" ? "IN_REVIEW" : input.action === "dismiss" ? "DISMISSED" : "ACTIONED";
    const changed = await db.abuseReport.updateMany({ where: { id: input.reportId, version: input.version }, data: { status: nextStatus, assignedToId: actor.id, resolution: input.reason, resolvedAt: nextStatus === "IN_REVIEW" ? null : new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, "Laporan telah diubah moderator lain. Muat ulang antrean.");
    if (input.action === "suspend_organizer") {
      await db.organization.update({ where: { id: before.organizationId }, data: { status: "SUSPENDED" } });
      await db.publicOrganizerProfile.updateMany({ where: { organizationId: before.organizationId }, data: { status: "SUSPENDED", suspendedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason } });
      await db.competitionPublication.updateMany({ where: { organizationId: before.organizationId }, data: { status: "SUSPENDED", suspendedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason } });
      await db.organizerVerification.updateMany({ where: { organizationId: before.organizationId }, data: { status: "SUSPENDED", reviewedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason, version: { increment: 1 } } });
    } else if (input.action === "unpublish_competition" && before.competitionId) {
      await db.competitionPublication.updateMany({ where: { competitionId: before.competitionId }, data: { status: "UNPUBLISHED", unpublishedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason } });
    }
    const after = await db.abuseReport.findUniqueOrThrow({ where: { id: input.reportId } });
    await audit(actor, before.organizationId, input.action === "dismiss" ? "REJECT" : "UPDATE", "AbuseReport", before.id, before, after);
    return after;
  });
}

export async function submitModerationAppeal(actor: ApiActor, raw: unknown) {
  const input = moderationAppealSchema.parse(raw);
  return tenant(input.organizationId, async () => {
    if (!actor.isPlatformAdmin) {
      const membership = await db.organizationMember.findFirst({ where: { organizationId: input.organizationId, userId: actor.id, isActive: true, organization: { deletedAt: null }, role: { permissions: { some: { permission: { key: "organization.moderation.appeal" } } } } }, select: { id: true } });
      if (!membership) throw new ApiError(403, "Anda tidak memiliki izin untuk mengajukan appeal.");
    }
    const report = await db.abuseReport.findFirst({ where: { id: input.reportId, organizationId: input.organizationId, status: "ACTIONED" } });
    if (!report) throw new ApiError(404, "Keputusan moderasi tidak ditemukan.");
    const appeal = await db.moderationAppeal.create({ data: input });
    await audit(actor, input.organizationId, "CREATE", "ModerationAppeal", appeal.id, null, { reportId: input.reportId, status: appeal.status });
    return appeal;
  });
}

export const appealQueue = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "abuse.moderate.view");
  return db.moderationAppeal.findMany({ where: { status: "PENDING" }, select: { id: true, reason: true, createdAt: true, organization: { select: { id: true, name: true, slug: true } }, report: { select: { id: true, category: true, resolution: true, targetType: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100 });
});

export async function reviewModerationAppeal(actor: ApiActor, raw: unknown) {
  const input = appealReviewSchema.parse(raw);
  return platform(async () => {
    await requirePlatformPermission(actor, "abuse.moderate.manage");
    const before = await db.moderationAppeal.findUnique({ where: { id: input.appealId } });
    if (!before) throw new ApiError(404, "Appeal tidak ditemukan.");
    if (before.status !== "PENDING") throw new ApiError(409, "Appeal sudah direview.");
    const after = await db.moderationAppeal.update({ where: { id: input.appealId }, data: { status: input.action === "uphold" ? "UPHELD" : "OVERTURNED", reviewedById: actor.id, reviewedAt: new Date(), reviewReason: input.reason } });
    await audit(actor, before.organizationId, input.action === "overturn" ? "APPROVE" : "REJECT", "ModerationAppeal", before.id, before, after);
    return after;
  });
}

export async function changeOrganizationState(actor: ApiActor, raw: unknown) {
  const input = organizationStateSchema.parse(raw);
  return platform(async () => {
    await requirePlatformPermission(actor, "platform.organizations.manage");
    const before = await db.organization.findUnique({ where: { id: input.organizationId } });
    if (!before || before.deletedAt) throw new ApiError(404, "Organisasi tidak ditemukan.");
    if (input.action === "reactivate" && before.status !== "SUSPENDED") throw new ApiError(409, "Hanya organisasi suspended yang dapat direaktivasi.");
    if (input.action === "suspend" && before.status === "ARCHIVED") throw new ApiError(409, "Organisasi archived tidak dapat disuspensi.");
    const after = await db.organization.update({ where: { id: input.organizationId }, data: { status: input.action === "suspend" ? "SUSPENDED" : "ACTIVE" } });
    if (input.action === "suspend") {
      await db.publicOrganizerProfile.updateMany({ where: { organizationId: input.organizationId }, data: { status: "SUSPENDED", suspendedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason } });
      await db.competitionPublication.updateMany({ where: { organizationId: input.organizationId }, data: { status: "SUSPENDED", suspendedAt: new Date(), reviewedById: actor.id, reviewReason: input.reason } });
    }
    await audit(actor, input.organizationId, "UPDATE", "Organization", input.organizationId, { status: before.status }, { status: after.status, reason: input.reason });
    return after;
  });
}

export const platformOperationsOverview = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "platform.operations.view");
  const [organizations, competitions, openReports, pendingVerification, failedJobs, pendingOutbox, failedStatistics, reconciliation, auditEvents] = await Promise.all([
    db.organization.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    db.competition.count({ where: { deletedAt: null } }),
    db.abuseReport.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.organizerVerification.count({ where: { status: "PENDING_REVIEW" } }),
    db.backgroundJob.count({ where: { status: { in: ["failed", "dead"] } } }),
    db.matchRealtimeOutbox.count({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 5 * 60_000) } } }),
    db.statisticsRecomputeJob.count({ where: { status: "FAILED" } }),
    db.reconciliationCase.count({ where: { status: { notIn: ["MATCHED", "RESOLVED"] } } }),
    db.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } }),
  ]);
  return { organizations, competitions, queues: { openReports, pendingVerification, failedJobs, pendingOutbox, failedStatistics, reconciliation }, auditEvents24h: auditEvents, generatedAt: new Date() };
});

export const platformAuditFeed = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "platform.audit.view");
  return db.auditLog.findMany({ select: { id: true, action: true, resourceType: true, resourceId: true, organizationId: true, actorId: true, createdAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100 });
});

export const platformOrganizationDirectory = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "platform.organizations.manage");
  return db.organization.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, status: true, createdAt: true, verification: { select: { status: true } }, subscription: { select: { status: true, planVersion: { select: { plan: { select: { code: true } } } } } }, _count: { select: { memberships: true, competitions: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
  });
});

export const platformUserOversight = (actor: ApiActor) => platform(async () => {
  await requirePlatformPermission(actor, "platform.users.view");
  return db.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, isActive: true, isPlatformAdmin: true, emailVerifiedAt: true, createdAt: true, memberships: { where: { isActive: true }, select: { organization: { select: { id: true, name: true, slug: true } }, role: { select: { name: true, key: true } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200,
  });
});
