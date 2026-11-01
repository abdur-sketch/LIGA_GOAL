import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiActor } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { withRegistrationDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { recordGenericScore } from "@/modules/phase19/service";
import { assignJudge, publicRegistrationStatus, reviewPublicRegistration, revokeJudgeAssignment, submitPublicRegistration, submitResultsForApproval, transitionResultWorkflow } from "./service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const owner = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : null;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);
let organizationId = ""; let otherOrganizationId = ""; let competitionId = ""; let sessionId = ""; let entryId = ""; let criterionId = "";
let organizerId = ""; let reviewerId = ""; let approverId = ""; let outsiderId = ""; let publicSlug = "";
let firstRegistration: Awaited<ReturnType<typeof submitPublicRegistration>>;

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
    const permissionKeys = ["competition.view", "generic_scoring.manage", "judge.assignment.view", "judge.assignment.manage", "registration.public.view", "registration.public.review", "result.workflow.submit", "result.workflow.review", "result.workflow.approve", "result.workflow.publish", "result.workflow.reopen"];
    await Promise.all(permissionKeys.map((key) => owner!.permission.upsert({ where: { key }, update: {}, create: { key, description: `Phase 21 synthetic permission: ${key}` } })));
    const permissions = await owner!.permission.findMany({ where: { key: { in: permissionKeys } } });
    expect(permissions).toHaveLength(permissionKeys.length);
    const roleFor = async (name: string, keys: string[]) => owner!.role.create({ data: { organizationId, name, key: `p21-${name.toLowerCase()}-${suffix}`, permissions: { create: permissions.filter((permission) => keys.includes(permission.key)).map((permission) => ({ permissionId: permission.id })) } } });
    const [organizerRole, reviewerRole, approverRole] = await Promise.all([
      roleFor("Organizer", ["competition.view", "generic_scoring.manage", "judge.assignment.view", "judge.assignment.manage", "registration.public.view", "registration.public.review", "result.workflow.submit", "result.workflow.review", "result.workflow.approve"]),
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
    const payload = { publicSlug, participantType: "TEAM", participantName: "Tim Publik A", institution: "Sekolah Sintetis", contactEmail: `team-a-${suffix}@test.invalid`, contactPhone: "080000000", teamData: {}, formData: { branch: "LCT" }, documents: [], idempotencyKey: `registration:${suffix}:a` };
    firstRegistration = await submitPublicRegistration(payload);
    const replay = await submitPublicRegistration(payload);
    expect(replay).toEqual(firstRegistration);
    const safe = await publicRegistrationStatus({ registrationNumber: firstRegistration.registrationNumber, token: firstRegistration.token });
    expect(safe.status).toBe("SUBMITTED");
    expect(safe).not.toHaveProperty("contactEmail"); expect(safe).not.toHaveProperty("contactPhone"); expect(safe).not.toHaveProperty("documents");
  });

  it("enforces quota atomically under concurrent registration", async () => {
    const submissions = await Promise.allSettled(["b", "c"].map((marker) => submitPublicRegistration({ publicSlug, participantType: "TEAM", participantName: `Tim Publik ${marker}`, contactEmail: `team-${marker}-${suffix}@test.invalid`, teamData: {}, formData: {}, documents: [], idempotencyKey: `registration:${suffix}:${marker}` })));
    expect(submissions.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(submissions.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(await owner!.publicRegistration.count({ where: { competitionId } })).toBe(2);
  });

  it("prevents duplicate participant identity with another idempotency key", async () => {
    await expect(submitPublicRegistration({ publicSlug, participantType: "TEAM", participantName: "Tim Publik A", contactEmail: `team-a-${suffix}@test.invalid`, teamData: {}, formData: {}, documents: [], idempotencyKey: `registration:${suffix}:duplicate` })).rejects.toMatchObject({ status: 409 });
  });

  it("isolates registrations and judge assignments at runtime-role RLS", async () => {
    expect(await runtime!.publicRegistration.count()).toBe(0);
    expect(await runtime!.judgeAssignment.count()).toBe(0);
    await withTenantDatabase(runtime!, organizationId, async (tx) => { expect(await tx.publicRegistration.count()).toBe(2); });
    await withTenantDatabase(runtime!, otherOrganizationId, async (tx) => { expect(await tx.publicRegistration.count()).toBe(0); });
    await withRegistrationDatabase("0".repeat(64), async () => { expect(await db.publicRegistration.count()).toBe(0); }, runtime!);
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
    await revokeJudgeAssignment(actor(organizerId), organizationId, assignment.id, "Synthetic immediate revoke test");
    await expect(recordGenericScore(actor(organizerId), { organizationId, sessionId, entryId, criterionId, score: 91, idempotencyKey: `p21-revoked-${suffix}` })).rejects.toMatchObject({ status: 403 });
    await assignJudge(actor(organizerId), { organizationId, competitionId, sessionId, judgeId: organizerId, idempotencyKey: `p21-judge-restored-${suffix}` });
    await expect(recordGenericScore(actor(outsiderId), { organizationId, sessionId, entryId, criterionId, score: 100, idempotencyKey: `p21-outsider-${suffix}` })).rejects.toMatchObject({ status: 403 });
  });

  it("enforces dual approval, self-approval prevention, locking, and audited publication", async () => {
    const submitted = await submitResultsForApproval(actor(organizerId), organizationId, competitionId, sessionId);
    expect(submitted.workflow.status).toBe("SUBMITTED");
    await expect(transitionResultWorkflow(actor(organizerId), { organizationId, competitionId, sessionId, action: "review" })).rejects.toMatchObject({ status: 409 });
    await transitionResultWorkflow(actor(reviewerId), { organizationId, competitionId, sessionId, action: "review" });
    await expect(transitionResultWorkflow(actor(organizerId), { organizationId, competitionId, sessionId, action: "approve" })).rejects.toMatchObject({ status: 409 });
    const approved = await transitionResultWorkflow(actor(approverId), { organizationId, competitionId, sessionId, action: "approve" });
    if ("workflow" in approved) throw new Error("Unexpected submit response");
    expect(approved.status).toBe("APPROVED"); expect(approved.lockedAt).toBeTruthy();
    await expect(owner!.genericResult.updateMany({ where: { competitionId }, data: { totalScore: 999 } })).rejects.toBeTruthy();
    const published = await transitionResultWorkflow(actor(approverId), { organizationId, competitionId, sessionId, action: "publish" });
    if ("workflow" in published) throw new Error("Unexpected submit response");
    expect(published.status).toBe("PUBLISHED");
    expect(await owner!.genericResult.count({ where: { competitionId, status: "PUBLISHED" } })).toBe(1);
    expect(await owner!.resultApprovalHistory.count({ where: { workflowId: published.id } })).toBe(4);
  });
});
