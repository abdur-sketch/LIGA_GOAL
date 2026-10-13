import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { appealQueue, moderationQueue, reviewAbuseReport, reviewModerationAppeal, reviewOrganizerVerification, submitAbuseReport, submitModerationAppeal, submitOrganizerVerification, verificationQueue } from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const setup = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : db;
const actor = (id: string, isPlatformAdmin = false) => ({ id, isActive: true, isPlatformAdmin, deletedAt: null });
let ownerId = "", moderatorId = "", unauthorizedId = "", organizationId = "", profileId = "", publicationId = "", verificationId = "";

describe.sequential("Phase 17 platform operations security", () => {
  afterAll(async () => { if (ownerUrl) await setup.$disconnect(); });
  beforeAll(async () => {
    const organization = await setup.organization.create({ data: { name: "Phase 17 Organizer", slug: `phase17-${suffix}`, status: "ACTIVE" } }); organizationId = organization.id;
    const permissions = await Promise.all(["organization.public_profile.manage", "organization.moderation.appeal"].map((key) => setup.permission.upsert({ where: { key }, update: {}, create: { key, description: "test" } })));
    const role = await setup.role.create({ data: { organizationId, name: "Owner", key: `phase17-owner-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
    const [owner, moderator, unauthorized] = await Promise.all([
      setup.user.create({ data: { name: "Owner", email: `phase17-owner-${suffix}@test.invalid`, passwordHash: "test", emailVerifiedAt: new Date() } }),
      setup.user.create({ data: { name: "Moderator", email: `phase17-moderator-${suffix}@test.invalid`, passwordHash: "test", emailVerifiedAt: new Date(), isPlatformAdmin: true } }),
      setup.user.create({ data: { name: "Unauthorized", email: `phase17-unauthorized-${suffix}@test.invalid`, passwordHash: "test", emailVerifiedAt: new Date(), isPlatformAdmin: true } }),
    ]); ownerId = owner.id; moderatorId = moderator.id; unauthorizedId = unauthorized.id;
    await setup.organizationMember.create({ data: { organizationId, userId: ownerId, roleId: role.id } });
    for (const permissionKey of ["organizer.verification.view", "organizer.verification.manage", "abuse.moderate.view", "abuse.moderate.manage", "platform.operations.view", "platform.organizations.manage", "platform.audit.view"]) await setup.platformPermissionGrant.create({ data: { userId: moderatorId, permission: permissionKey, grantedById: moderatorId, reason: "PHASE17_TEST" } });
    const competition = await setup.competition.create({ data: { organizationId, name: "Phase 17 Cup", slug: `phase17-cup-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "ONGOING" } });
    const profile = await setup.publicOrganizerProfile.create({ data: { organizationId, publicSlug: `phase17-${suffix}`, displayName: "Phase 17 Organizer", status: "PUBLISHED", publishedAt: new Date() } }); profileId = profile.id;
    const publication = await setup.competitionPublication.create({ data: { organizationId, competitionId: competition.id, publicSlug: `phase17-cup-${suffix}`, status: "PUBLISHED", publishedAt: new Date(), searchText: "phase 17 cup" } }); publicationId = publication.id;
  });

  it("separates verification from publication and blocks ungranted platform users", async () => {
    const verification = await submitOrganizerVerification(actor(ownerId), { organizationId, evidence: { registrationNumber: "AHU-PHASE-17" } }); verificationId = verification.id;
    expect(verification.status).toBe("PENDING_REVIEW");
    expect((await setup.publicOrganizerProfile.findUniqueOrThrow({ where: { id: profileId } })).status).toBe("PUBLISHED");
    await expect(verificationQueue(actor(unauthorizedId, true))).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    expect((await verificationQueue(actor(moderatorId, true))).some((item) => item.id === verificationId)).toBe(true);
  });

  it("prevents concurrent verification decisions and exposes a badge only after approval", async () => {
    const current = await setup.organizerVerification.findUniqueOrThrow({ where: { id: verificationId } });
    const decisions = await Promise.allSettled([
      reviewOrganizerVerification(actor(moderatorId, true), { id: verificationId, version: current.version, action: "verify", reason: "Dokumen organisasi telah tervalidasi" }),
      reviewOrganizerVerification(actor(moderatorId, true), { id: verificationId, version: current.version, action: "reject", reason: "Dokumen organisasi perlu diperbaiki" }),
    ]);
    expect(decisions.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((item) => item.status === "rejected")).toHaveLength(1);
  });

  it("accepts reports only for published targets and prevents cross-target mismatch", async () => {
    const report = await submitAbuseReport({ targetType: "COMPETITION", targetId: publicationId, category: "MISLEADING", description: "Informasi jadwal diduga menyesatkan publik." }, "test-request");
    expect(report.status).toBe("OPEN");
    await expect(submitAbuseReport({ targetType: "ORGANIZER", targetId: "missing", category: "OTHER", description: "Laporan yang cukup panjang tetapi target tidak ada." }, "test-request")).rejects.toMatchObject({ status: 404 } satisfies Partial<ApiError>);
    expect((await moderationQueue(actor(moderatorId, true))).some((item) => item.id === report.id)).toBe(true);
  });

  it("suspends visibility without deleting competition or financial history", async () => {
    const report = await setup.abuseReport.findFirstOrThrow({ where: { organizationId, status: "OPEN" } });
    await reviewAbuseReport(actor(moderatorId, true), { reportId: report.id, version: report.version, action: "suspend_organizer", reason: "Pelanggaran kebijakan tervalidasi moderator" });
    const [organization, competition, publication, audits] = await Promise.all([
      setup.organization.findUniqueOrThrow({ where: { id: organizationId } }), setup.competition.findFirstOrThrow({ where: { organizationId } }), setup.competitionPublication.findUniqueOrThrow({ where: { id: publicationId } }), setup.auditLog.count({ where: { organizationId, resourceType: "AbuseReport" } }),
    ]);
    expect(organization.status).toBe("SUSPENDED"); expect(competition.deletedAt).toBeNull(); expect(publication.status).toBe("SUSPENDED"); expect(audits).toBeGreaterThan(0);
  });

  it("keeps appeal tenant-scoped and requires an explicit platform decision", async () => {
    const report = await setup.abuseReport.findFirstOrThrow({ where: { organizationId, status: "ACTIONED" } });
    const appeal = await submitModerationAppeal(actor(ownerId), { organizationId, reportId: report.id, reason: "Kami meminta peninjauan ulang berdasarkan bukti terbaru." });
    expect(appeal.status).toBe("PENDING");
    expect((await appealQueue(actor(moderatorId, true))).some((item) => item.id === appeal.id)).toBe(true);
    const reviewed = await reviewModerationAppeal(actor(moderatorId, true), { appealId: appeal.id, action: "overturn", reason: "Bukti terbaru mengubah hasil pemeriksaan." });
    expect(reviewed.status).toBe("OVERTURNED");
    expect((await setup.organization.findUniqueOrThrow({ where: { id: organizationId } })).status).toBe("SUSPENDED");
  });
});
