import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiActor } from "@/lib/auth/api";
import {
  createCompetitionSession,
  createGenericCompetition,
  createParticipant,
  createScoringCriterion,
  publishCompetitionSession,
  publishGenericResults,
  recordGenericScore,
  registerGenericEntry,
} from "@/modules/phase19/service";
import { assignJudge, transitionResultWorkflow } from "@/modules/phase21/service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const setup = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);
let organizationId = "";
let organizerId = "";
let viewerId = "";
let reviewerId = "";
let approverId = "";
let festivalId = "";

const organizer = (): ApiActor => ({ id: organizerId, isActive: true, isPlatformAdmin: false, deletedAt: null });
const viewer = (): ApiActor => ({ id: viewerId, isActive: true, isPlatformAdmin: false, deletedAt: null });
const reviewer = (): ApiActor => ({ id: reviewerId, isActive: true, isPlatformAdmin: false, deletedAt: null });
const approver = (): ApiActor => ({ id: approverId, isActive: true, isPlatformAdmin: false, deletedAt: null });

const templates = [
  { code: "football", label: "Sepak Bola", participantType: "TEAM" as const },
  { code: "lct", label: "LCT", participantType: "TEAM" as const },
  { code: "school", label: "Lomba Sekolah", participantType: "INDIVIDUAL" as const },
  { code: "arts", label: "Seni", participantType: "INDIVIDUAL" as const },
  { code: "religious", label: "Keagamaan", participantType: "INDIVIDUAL" as const },
  { code: "festival", label: "Gebyar Festival", participantType: "TEAM" as const },
  { code: "esports", label: "E-Sports", participantType: "TEAM" as const },
  { code: "custom", label: "Custom", participantType: "INDIVIDUAL" as const },
] as const;

describe.skipIf(!setup).sequential("Phase 20 staging UAT for eight competition templates", () => {
  beforeAll(async () => {
    const [organizerUser, viewerUser, reviewerUser, approverUser] = await Promise.all([
      setup!.user.create({ data: { email: `p20-organizer-${suffix}@test.invalid`, name: "P20 Synthetic Organizer", passwordHash: "test-only", emailVerifiedAt: new Date() } }),
      setup!.user.create({ data: { email: `p20-viewer-${suffix}@test.invalid`, name: "P20 Synthetic Viewer", passwordHash: "test-only", emailVerifiedAt: new Date() } }),
      setup!.user.create({ data: { email: `p20-reviewer-${suffix}@test.invalid`, name: "P20 Synthetic Reviewer", passwordHash: "test-only", emailVerifiedAt: new Date() } }),
      setup!.user.create({ data: { email: `p20-approver-${suffix}@test.invalid`, name: "P20 Synthetic Approver", passwordHash: "test-only", emailVerifiedAt: new Date() } }),
    ]);
    organizerId = organizerUser.id;
    viewerId = viewerUser.id;
    reviewerId = reviewerUser.id;
    approverId = approverUser.id;
    const organization = await setup!.organization.create({
      data: { name: "P20 Synthetic Organizer", slug: `p20-uat-${suffix}`, status: "ACTIVE", ownerId: organizerId, contactEmail: organizerUser.email },
    });
    organizationId = organization.id;

    const manageKeys = ["competition.create", "competition.view", "competition.update", "participant.view", "participant.manage", "competition_session.view", "competition_session.manage", "generic_scoring.view", "generic_scoring.manage", "judge.assignment.view", "judge.assignment.manage", "result.workflow.submit"];
    const viewKeys = ["competition.view", "participant.view", "competition_session.view", "generic_scoring.view"];
    await Promise.all(manageKeys.map((key) => setup!.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Phase 20 synthetic UAT permission: ${key}` },
    })));
    const permissions = await setup!.permission.findMany({ where: { key: { in: manageKeys } }, select: { id: true, key: true } });
    expect(permissions).toHaveLength(manageKeys.length);
    const ownerRole = await setup!.role.create({
      data: { organizationId, name: "P20 UAT Owner", key: `p20-uat-owner-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } },
    });
    const viewerRole = await setup!.role.create({
      data: { organizationId, name: "P20 UAT Viewer", key: `p20-uat-viewer-${suffix}`, permissions: { create: permissions.filter((permission) => viewKeys.includes(permission.key)).map((permission) => ({ permissionId: permission.id })) } },
    });
    const reviewerPermission = await setup!.permission.findUniqueOrThrow({ where: { key: "result.workflow.review" } });
    const approverPermissions = await setup!.permission.findMany({ where: { key: { in: ["result.workflow.approve", "result.workflow.publish"] } } });
    const reviewerRole = await setup!.role.create({ data: { organizationId, name: "P20 UAT Reviewer", key: `p20-uat-reviewer-${suffix}`, permissions: { create: [{ permissionId: reviewerPermission.id }] } } });
    const approverRole = await setup!.role.create({ data: { organizationId, name: "P20 UAT Approver", key: `p20-uat-approver-${suffix}`, permissions: { create: approverPermissions.map((permission) => ({ permissionId: permission.id })) } } });
    await setup!.organizationMember.createMany({ data: [
      { organizationId, userId: organizerId, roleId: ownerRole.id },
      { organizationId, userId: viewerId, roleId: viewerRole.id },
      { organizationId, userId: reviewerId, roleId: reviewerRole.id },
      { organizationId, userId: approverId, roleId: approverRole.id },
    ] });
    await setup!.organizationSubscription.create({ data: { organizationId, planVersionId: "pv_enterprise_v1", status: "ACTIVE", reason: "PHASE_20_SYNTHETIC_UAT" } });
  });

  afterAll(async () => {
    await setup?.$disconnect();
  });

  for (const [index, template] of templates.entries()) {
    it(`${template.label}: completes registration, scoring, ranking, and publication`, async () => {
      const marker = `${template.code}-${suffix}`;
      const competition = await createGenericCompetition(organizer(), {
        organizationId,
        templateCode: template.code,
        name: `UAT ${template.label} ${suffix}`,
        slug: `uat-${marker}`,
        startsAt: new Date(Date.now() + (index + 1) * 3_600_000),
        endsAt: new Date(Date.now() + (index + 2) * 3_600_000),
        parentCompetitionId: template.code === "custom" ? festivalId : undefined,
        idempotencyKey: `competition:${marker}`,
      });
      if (template.code === "festival") festivalId = competition.id;
      if (template.code === "custom") expect(competition.parentCompetitionId).toBe(festivalId);

      const participants = await Promise.all([1, 2].map((number) => createParticipant(organizer(), {
        organizationId,
        type: template.participantType,
        name: `${template.label} Peserta ${number}`,
        slug: `${marker}-peserta-${number}`,
        institution: `Sekolah Sintetis ${number}`,
        contactEmail: `synthetic-${marker}-${number}@test.invalid`,
      })));
      const entries = await Promise.all(participants.map((participant, participantIndex) => registerGenericEntry(organizer(), {
        organizationId,
        competitionId: competition.id,
        participantId: participant.id,
        idempotencyKey: `entry:${marker}:${participantIndex + 1}`,
      })));
      expect(entries.every((entry) => entry.status === "APPROVED" && entry.approvedAt)).toBe(true);

      const session = await createCompetitionSession(organizer(), {
        organizationId,
        competitionId: competition.id,
        name: "Babak Final",
        sequence: 1,
        startsAt: new Date(Date.now() + (index + 1) * 3_600_000),
        entryIds: entries.map((entry) => entry.id),
      });
      await publishCompetitionSession(organizer(), { organizationId, competitionId: competition.id, sessionId: session.id });
      await assignJudge(organizer(), { organizationId, competitionId: competition.id, sessionId: session.id, judgeId: organizerId, idempotencyKey: `judge:${marker}` });

      let criterion = await setup!.scoringCriterion.findFirst({ where: { competitionId: competition.id }, orderBy: { sortOrder: "asc" } });
      criterion ??= await createScoringCriterion(organizer(), {
        organizationId,
        competitionId: competition.id,
        name: "Nilai Utama",
        code: "NILAI_UTAMA",
        weight: 1,
        maxScore: 100,
      });
      await Promise.all(entries.map((entry, entryIndex) => recordGenericScore(organizer(), {
        organizationId,
        sessionId: session.id,
        entryId: entry.id,
        criterionId: criterion!.id,
        score: entryIndex === 0 ? 90 : 80,
        penalty: 0,
        idempotencyKey: `score:${marker}:${entryIndex + 1}`,
      })));
      const ranking = await publishGenericResults(organizer(), { organizationId, competitionId: competition.id, sessionId: session.id });
      expect(ranking.map((result) => result.rank)).toEqual([1, 2]);
      expect(ranking.map((result) => result.totalScore)).toEqual([90 * criterion.weight, 80 * criterion.weight]);
      await transitionResultWorkflow(reviewer(), { organizationId, competitionId: competition.id, sessionId: session.id, action: "review" });
      await transitionResultWorkflow(approver(), { organizationId, competitionId: competition.id, sessionId: session.id, action: "approve" });
      await transitionResultWorkflow(approver(), { organizationId, competitionId: competition.id, sessionId: session.id, action: "publish" });

      await setup!.$transaction([
        setup!.competition.update({ where: { id: competition.id }, data: { status: "ONGOING" } }),
        setup!.competitionPublication.create({ data: { organizationId, competitionId: competition.id, publicSlug: `uat-public-${marker}`, status: "PUBLISHED", publishedAt: new Date() } }),
      ]);
      expect(await setup!.genericResult.count({ where: { competitionId: competition.id, status: "PUBLISHED" } })).toBe(2);
    });
  }

  it("denies score manipulation by a viewer without scoring permission", async () => {
    const competition = await setup!.competition.findFirstOrThrow({ where: { organizationId, slug: `uat-lct-${suffix}` } });
    const session = await setup!.competitionSession.findFirstOrThrow({ where: { competitionId: competition.id } });
    const entry = await setup!.genericCompetitionEntry.findFirstOrThrow({ where: { competitionId: competition.id } });
    const criterion = await setup!.scoringCriterion.findFirstOrThrow({ where: { competitionId: competition.id } });
    await expect(recordGenericScore(viewer(), {
      organizationId,
      sessionId: session.id,
      entryId: entry.id,
      criterionId: criterion.id,
      score: 100,
      idempotencyKey: `viewer-denied:${suffix}`,
    })).rejects.toMatchObject({ status: 403 });
  });
});
