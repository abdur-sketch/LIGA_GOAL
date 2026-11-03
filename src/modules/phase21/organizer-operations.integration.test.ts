import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiActor } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { withRegistrationDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { recordGenericScore } from "@/modules/phase19/service";
import { assignJudge, configurePublicRegistration, getOrganizerOperations, getPublicRegistrationReviewDetail, publicRegistrationStatus, reviewPublicRegistration, revokeJudgeAssignment, submitPublicRegistration, submitResultsForApproval, transitionResultWorkflow } from "./service";
import { retentionPreview, submitPrivacyRequest } from "@/modules/phase22/service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const owner = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : null;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);
let organizationId = ""; let otherOrganizationId = ""; let competitionId = ""; let sessionId = ""; let entryId = ""; let criterionId = "";
let organizerId = ""; let reviewerId = ""; let approverId = ""; let outsiderId = ""; let publicSlug = "";
let firstRegistration: Awaited<ReturnType<typeof submitPublicRegistration>>;
const privacy = { privacyAccepted: true as const, privacyVersion: "phase22-draft-2026-11-01" as const, processingContext: { source: "synthetic-test" }, isMinor: false, guardianConsent: false };

const actor = (id: string): ApiActor => ({ id, isActive: true, isPlatformAdmin: false, deletedAt: null });

describe.skipIf(!owner || !runtime).sequential("Phase 21 organizer operations and public registration", () => {
  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET ||= "phase21-test-secret-with-at-least-thirty-two-characters";
    const users = await Promise.all(["organizer", "reviewer", "approver", "outsider"].map((label) => owner!.user.create({ data: { email: `p21-${label}-${suffix}@test.invalid`, name: `P21 ${label}`, passwordHash: "synthetic-only", emailVerifiedAt: new Date() } })));
    [organizerId, reviewerId, approverId, outsiderId] = users.map((user) => user.id);
    const [organization, otherOrganization] = await Promise.all([
      owner!.organization.create({ data: { name: "P21 Synthetic Organizer", slug: `p21-${suffix}`, status: "ACTIVE", ownerId: organizerId, contactEmail: users[0].email } }),
      owner!.organization.create({ data: { name: "P21 Other Tenant", slug: `p21-other-${suffix}`, status: "ACTIVE", ownerId: outsiderId, contactEmail: users[3].email } }),
    ]);
    organizationId = organization.id; otherOrganizationId = otherOrganization.id;
    const permissionKeys = ["competition.view", "competition.update", "generic_scoring.manage", "judge.assignment.view", "judge.assignment.manage", "registration.public.view", "registration.public.review", "privacy.request.view", "privacy.request.manage", "result.workflow.submit", "result.workflow.review", "result.workflow.approve", "result.workflow.publish", "result.workflow.reopen"];
    await Promise.all(permissionKeys.map((key) => owner!.permission.upsert({ where: { key }, update: {}, create: { key, description: `Phase 21 synthetic permission: ${key}` } })));
    const permissions = await owner!.permission.findMany({ where: { key: { in: permissionKeys } } });
    expect(permissions).toHaveLength(permissionKeys.length);
    const roleFor = async (name: string, keys: string[]) => owner!.role.create({ data: { organizationId, name, key: `p21-${name.toLowerCase()}-${suffix}`, permissions: { create: permissions.filter((permission) => keys.includes(permission.key)).map((permission) => ({ permissionId: permission.id })) } } });
    const [organizerRole, reviewerRole, approverRole] = await Promise.all([
      roleFor("Organizer", ["competition.view", "competition.update", "generic_scoring.manage", "judge.assignment.view", "judge.assignment.manage", "registration.public.view", "registration.public.review", "privacy.request.view", "privacy.request.manage", "result.workflow.submit", "result.workflow.review", "result.workflow.approve"]),
      roleFor("Reviewer", ["competition.view", "result.workflow.review"]),
      roleFor("Approver", ["competition.view", "result.workflow.approve", "result.workflow.publish", "result.workflow.reopen"]),
    ]);
    await owner!.organizationMember.createMany({ data: [{ organizationId, userId: organizerId, roleId: organizerRole.id }, { organizationId, userId: reviewerId, roleId: reviewerRole.id }, { organizationId, userId: approverId, roleId: approverRole.id }] });
    const competition = await owner!.competition.create({ data: { organizationId, name: "P21 LCT Pilot", slug: `p21-lct-${suffix}`, format: "GROUP_STAGE", status: "REGISTRATION", genericProfile: { create: { kind: "QUIZ", participantMode: "BOTH", scoringMethod: "POINTS", publicRegistrationEnabled: true, registrationQuota: 2 } } } });
    competitionId = competition.id; publicSlug = `p21-public-${suffix}`;
    await owner!.competitionPublication.create({ data: { organizationId, competitionId, publicSlug, status: "PUBLISHED", publishedAt: new Date() } });
    const participant = await owner!.competitionParticipant.create({ data: { organizationId, type: "TEAM", name: "P21 Scoring Team", slug: `p21-score-${suffix}` } });
    const entry = await owner!.genericCompetitionEntry.create({ data: { organizationId, competitionId, participantId: participant.id, status: "APPROVED", idempotencyKey: `p21-entry-${suffix}`, submittedAt: new Date(), approvedAt: new Date() } }); entryId = entry.id;
    const session = await owner!.competitionSession.create({ data: { organizationId, competitionId, name: "Final LCT", sequence: 1, status: "LIVE", startsAt: new Date() } }); sessionId = session.id;
    await owner!.competitionSessionEntry.create({ data: { sessionId, entryId } });
    const criterion = await owner!.scoringCriterion.create({ data: { organizationId, competitionId, name: "Jawaban Benar", code: "BENAR", maxScore: 100 } }); criterionId = criterion.id;
  });

  afterAll(async () => { await runtime?.$disconnect(); await owner?.$disconnect(); });

  it("accepts an idempotent public registration without exposing private fields", async () => {
    const payload = { publicSlug, participantType: "TEAM", participantName: "Tim Publik A", institution: "Sekolah Sintetis", contactEmail: `team-a-${suffix}@test.invalid`, contactPhone: "080000000", teamData: {}, formData: { branch: "LCT" }, documents: [{ storageKey: `${organizationId}/00000000-0000-4000-8000-000000000000.pdf`, originalName: "surat-sekolah.pdf", mimeType: "application/pdf" as const, sizeBytes: 128 }], idempotencyKey: `registration:${suffix}:a`, ...privacy };
    firstRegistration = await submitPublicRegistration(payload);
    const replay = await submitPublicRegistration(payload);
    expect(replay).toEqual(firstRegistration);
    const safe = await publicRegistrationStatus({ registrationNumber: firstRegistration.registrationNumber, token: firstRegistration.token });
    expect(safe.status).toBe("SUBMITTED");
    expect(safe).not.toHaveProperty("contactEmail"); expect(safe).not.toHaveProperty("contactPhone"); expect(safe).not.toHaveProperty("documents");
  });

  it("publishes a safe registration endpoint for a new draft competition", async () => {
    const competition = await owner!.competition.create({ data: { organizationId, name: "P26 Registration Pilot", slug: `p26-registration-${suffix}`, format: "GROUP_STAGE", status: "DRAFT", genericProfile: { create: { kind: "ACADEMIC", participantMode: "BOTH", scoringMethod: "POINTS" } } } });
    const configured = await configurePublicRegistration(actor(organizerId), { organizationId, competitionId: competition.id, publicSlug: `p26-public-${suffix}`, enabled: true, quota: 25, requirements: [] });
    expect(configured.publication).toEqual({ publicSlug: `p26-public-${suffix}`, status: "PUBLISHED" });
    expect((await owner!.competition.findUniqueOrThrow({ where: { id: competition.id } })).status).toBe("REGISTRATION");
  });

  it("reveals registration administration data only through an audited tenant-scoped DAL", async () => {
    const registration = await owner!.publicRegistration.findFirstOrThrow({ where: { registrationNumber: firstRegistration.registrationNumber } });
    const detail = await getPublicRegistrationReviewDetail(actor(organizerId), organizationId, registration.id);
    expect(detail.contactEmail).toBe(`team-a-${suffix}@test.invalid`);
    expect(detail.documents).toEqual([{ index: 0, originalName: "surat-sekolah.pdf", mimeType: "application/pdf", sizeBytes: 128 }]);
    expect(detail.documents[0]).not.toHaveProperty("storageKey");
    expect(await owner!.sensitiveDataAccessLog.count({ where: { organizationId, actorId: organizerId, resourceType: "PublicRegistration", resourceId: registration.id } })).toBe(1);
    await expect(getPublicRegistrationReviewDetail(actor(outsiderId), organizationId, registration.id)).rejects.toMatchObject({ status: 403 });
    await expect(getPublicRegistrationReviewDetail(actor(organizerId), otherOrganizationId, registration.id)).rejects.toMatchObject({ status: 403 });
  });

  it("enforces quota atomically under concurrent registration", async () => {
    const submissions = await Promise.allSettled(["b", "c"].map((marker) => submitPublicRegistration({ publicSlug, participantType: "TEAM", participantName: `Tim Publik ${marker}`, contactEmail: `team-${marker}-${suffix}@test.invalid`, teamData: {}, formData: {}, documents: [], idempotencyKey: `registration:${suffix}:${marker}`, ...privacy })));
    expect(submissions.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(submissions.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(await owner!.publicRegistration.count({ where: { competitionId } })).toBe(2);
  });

  it("prevents duplicate participant identity with another idempotency key", async () => {
    await expect(submitPublicRegistration({ publicSlug, participantType: "TEAM", participantName: "Tim Publik A", contactEmail: `team-a-${suffix}@test.invalid`, teamData: {}, formData: {}, documents: [], idempotencyKey: `registration:${suffix}:duplicate`, ...privacy })).rejects.toMatchObject({ status: 409 });
  });

  it("records a verified erasure request without executing retention automatically", async () => {
    await expect(submitPrivacyRequest({ registrationNumber: firstRegistration.registrationNumber, registrationToken: firstRegistration.token, requesterEmail: `wrong-${suffix}@test.invalid`, type: "ACCESS", description: "Permintaan dengan email yang tidak cocok", idempotencyKey: `privacy:${suffix}:wrong` })).rejects.toMatchObject({ status: 404 });
    const request = await submitPrivacyRequest({ registrationNumber: firstRegistration.registrationNumber, registrationToken: firstRegistration.token, requesterEmail: `team-a-${suffix}@test.invalid`, type: "ERASURE", description: "Mohon anonimisasi setelah kewajiban lomba selesai", idempotencyKey: `privacy:${suffix}:erase` });
    expect(request.status).toBe("VERIFIED"); expect(request.token).toMatch(/^[A-Za-z0-9_-]+$/);
    const registration = await owner!.publicRegistration.findFirstOrThrow({ where: { registrationNumber: firstRegistration.registrationNumber } });
    expect(registration.deletionRequestedAt).toBeTruthy(); expect(registration.anonymizedAt).toBeNull();
    const preview = await retentionPreview(actor(organizerId), { organizationId });
    expect(preview.mode).toBe("DRY_RUN_ONLY"); expect(preview.policyStatus).toBe("PENDING_OWNER_APPROVAL"); expect(preview.deletionRequested).toBe(1);
  });

  it("isolates registrations and judge assignments at runtime-role RLS", async () => {
    expect(await runtime!.publicRegistration.count()).toBe(0);
    expect(await runtime!.judgeAssignment.count()).toBe(0);
    expect(await runtime!.privacyDataRequest.count()).toBe(0);
    expect(await runtime!.sensitiveDataAccessLog.count()).toBe(0);
    await withTenantDatabase(runtime!, organizationId, async (tx) => { expect(await tx.publicRegistration.count()).toBe(2); });
    await withTenantDatabase(runtime!, otherOrganizationId, async (tx) => { expect(await tx.publicRegistration.count()).toBe(0); });
    await withRegistrationDatabase("0".repeat(64), async () => { expect(await db.publicRegistration.count()).toBe(0); }, runtime!);
  });

  it("audits sensitive queue access in an immutable tenant log", async () => {
    await getOrganizerOperations(actor(organizerId), organizationId);
    const access = await owner!.sensitiveDataAccessLog.findFirstOrThrow({ where: { organizationId, actorId: organizerId, resourceType: "PublicRegistrationQueue" } });
    expect(access.fieldSet).not.toContain("contactEmail");
    await expect(owner!.sensitiveDataAccessLog.update({ where: { id: access.id }, data: { purpose: "tampered" } })).rejects.toBeTruthy();
  });

  it("verifies a public registration transactionally", async () => {
    const registration = await owner!.publicRegistration.findFirstOrThrow({ where: { registrationNumber: firstRegistration.registrationNumber } });
    await reviewPublicRegistration(actor(organizerId), { organizationId, registrationId: registration.id, action: "start-review" });
    const approved = await reviewPublicRegistration(actor(organizerId), { organizationId, registrationId: registration.id, action: "approve" });
    expect(approved.status).toBe("APPROVED");
    const persisted = await owner!.publicRegistration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(persisted.approvedParticipantId).toBeTruthy(); expect(persisted.approvedEntryId).toBeTruthy();
  });

  it("denies scoring before assignment and immediately after revocation scope changes", async () => {
    await expect(recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 90, idempotencyKey: `p21-denied-${suffix}` })).rejects.toMatchObject({ status: 403 });
    const assignment = await assignJudge(actor(organizerId), { organizationId, competitionId, sessionId, judgeId: organizerId, idempotencyKey: `p21-judge-${suffix}` });
    const score = await recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 90, idempotencyKey: `p21-score-${suffix}` });
    expect(score.judgeId).toBe(organizerId);
    const concurrentScores = await Promise.all(Array.from({ length: 10 }, () => recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 90, idempotencyKey: `p21-score-${suffix}` })));
    expect(new Set(concurrentScores.map((item) => item.id))).toEqual(new Set([score.id]));
    await revokeJudgeAssignment(actor(organizerId), organizationId, assignment.id, "Synthetic immediate revoke test");
    await expect(recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 91, idempotencyKey: `p21-revoked-${suffix}` })).rejects.toMatchObject({ status: 403 });
    await assignJudge(actor(organizerId), { organizationId, competitionId, sessionId, judgeId: organizerId, idempotencyKey: `p21-judge-restored-${suffix}` });
    const corrected = await recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 92, idempotencyKey: `p28-correction-${suffix}` });
    const correctionReplay = await recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 92, idempotencyKey: `p28-correction-${suffix}` });
    expect(corrected.id).toBe(score.id); expect(correctionReplay.id).toBe(score.id); expect(correctionReplay.score).toBe(92);
    expect(await owner!.genericScoreEntry.count({ where: { organizationId, sessionId, entryId, criterionId, judgeId: organizerId } })).toBe(1);
    await expect(recordGenericScore(actor(outsiderId), { organizationId, sessionId, entryId, criterionId, score: 100, idempotencyKey: `p21-outsider-${suffix}` })).rejects.toMatchObject({ status: 403 });
  });

  it("enforces dual approval, self-approval prevention, locking, and audited publication", async () => {
    const submitted = await submitResultsForApproval(actor(organizerId), organizationId, competitionId, sessionId);
    expect(submitted.workflow.status).toBe("SUBMITTED");
    await expect(transitionResultWorkflow(actor(organizerId), { organizationId, competitionId, sessionId, action: "review" })).rejects.toMatchObject({ status: 409 });
    await transitionResultWorkflow(actor(reviewerId), { organizationId, competitionId, sessionId, action: "review" });
    await expect(transitionResultWorkflow(actor(organizerId), { organizationId, competitionId, sessionId, action: "approve" })).rejects.toMatchObject({ status: 409 });
    const approvalRace = await Promise.allSettled(Array.from({ length: 2 }, () => transitionResultWorkflow(actor(approverId), { organizationId, competitionId, sessionId, action: "approve" })));
    expect(approvalRace.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(approvalRace.filter((item) => item.status === "rejected")).toHaveLength(1);
    const approved = approvalRace.find((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof transitionResultWorkflow>>> => item.status === "fulfilled")!.value;
    if ("workflow" in approved) throw new Error("Unexpected submit response");
    expect(approved.status).toBe("APPROVED"); expect(approved.lockedAt).toBeTruthy();
    await expect(owner!.genericResult.updateMany({ where: { competitionId }, data: { totalScore: 999 } })).rejects.toBeTruthy();
    const publicationRace = await Promise.allSettled(Array.from({ length: 2 }, () => transitionResultWorkflow(actor(approverId), { organizationId, competitionId, sessionId, action: "publish" })));
    expect(publicationRace.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(publicationRace.filter((item) => item.status === "rejected")).toHaveLength(1);
    const published = publicationRace.find((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof transitionResultWorkflow>>> => item.status === "fulfilled")!.value;
    if ("workflow" in published) throw new Error("Unexpected submit response");
    expect(published.status).toBe("PUBLISHED");
    expect(await owner!.genericResult.count({ where: { competitionId, status: "PUBLISHED" } })).toBe(1);
    expect(await owner!.resultApprovalHistory.count({ where: { workflowId: published.id } })).toBe(4);
  });
});
