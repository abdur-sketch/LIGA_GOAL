import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withPlatformDatabase, withTenantDatabase } from "@/lib/tenant-db";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const owner = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : null;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);

let organizationA = "";
let organizationB = "";
let competitionA = "";
let competitionB = "";
let participantA = "";
let unassignedParticipantA = "";
let participantB = "";
let entryA = "";
let unassignedEntryA = "";
let entryB = "";
let sessionA = "";
let sessionB = "";
let criterionA = "";

describe.skipIf(!owner || !runtime)("Phase 20 multi-competition runtime RLS", () => {
  beforeAll(async () => {
    const [orgA, orgB] = await Promise.all([
      owner!.organization.create({ data: { name: "P20 Tenant A", slug: `p20-a-${suffix}`, status: "ACTIVE" } }),
      owner!.organization.create({ data: { name: "P20 Tenant B", slug: `p20-b-${suffix}`, status: "ACTIVE" } }),
    ]);
    organizationA = orgA.id;
    organizationB = orgB.id;

    const [compA, compB] = await Promise.all([
      owner!.competition.create({
        data: {
          organizationId: organizationA,
          name: "P20 Competition A",
          slug: `p20-comp-a-${suffix}`,
          format: "GROUP_STAGE",
          status: "ONGOING",
          genericProfile: { create: { kind: "OTHER", participantMode: "BOTH", scoringMethod: "JUDGES" } },
        },
      }),
      owner!.competition.create({
        data: {
          organizationId: organizationB,
          name: "P20 Competition B",
          slug: `p20-comp-b-${suffix}`,
          format: "GROUP_STAGE",
          status: "DRAFT",
          genericProfile: { create: { kind: "OTHER", participantMode: "BOTH", scoringMethod: "JUDGES" } },
        },
      }),
    ]);
    competitionA = compA.id;
    competitionB = compB.id;

    const [partA, spareA, partB] = await Promise.all([
      owner!.competitionParticipant.create({ data: { organizationId: organizationA, type: "TEAM", name: "Team A", slug: `team-a-${suffix}`, contactEmail: `private-a-${suffix}@test.invalid` } }),
      owner!.competitionParticipant.create({ data: { organizationId: organizationA, type: "TEAM", name: "Spare A", slug: `spare-a-${suffix}` } }),
      owner!.competitionParticipant.create({ data: { organizationId: organizationB, type: "TEAM", name: "Team B", slug: `team-b-${suffix}`, contactEmail: `private-b-${suffix}@test.invalid` } }),
    ]);
    participantA = partA.id;
    unassignedParticipantA = spareA.id;
    participantB = partB.id;

    const [registeredA, spareEntryA, registeredB] = await Promise.all([
      owner!.genericCompetitionEntry.create({ data: { organizationId: organizationA, competitionId: competitionA, participantId: partA.id, status: "APPROVED", idempotencyKey: `entry-a-${suffix}`, submittedAt: new Date(), approvedAt: new Date() } }),
      owner!.genericCompetitionEntry.create({ data: { organizationId: organizationA, competitionId: competitionA, participantId: spareA.id, status: "APPROVED", idempotencyKey: `entry-spare-a-${suffix}`, submittedAt: new Date(), approvedAt: new Date() } }),
      owner!.genericCompetitionEntry.create({ data: { organizationId: organizationB, competitionId: competitionB, participantId: partB.id, status: "APPROVED", idempotencyKey: `entry-b-${suffix}`, submittedAt: new Date(), approvedAt: new Date() } }),
    ]);
    entryA = registeredA.id;
    unassignedEntryA = spareEntryA.id;
    entryB = registeredB.id;

    const [roundA, roundB] = await Promise.all([
      owner!.competitionSession.create({ data: { organizationId: organizationA, competitionId: competitionA, name: "Final A", sequence: 1, status: "COMPLETED", startsAt: new Date(), publishedAt: new Date() } }),
      owner!.competitionSession.create({ data: { organizationId: organizationB, competitionId: competitionB, name: "Final B", sequence: 1, status: "COMPLETED", startsAt: new Date(), publishedAt: new Date() } }),
    ]);
    sessionA = roundA.id;
    sessionB = roundB.id;
    await owner!.competitionSessionEntry.createMany({ data: [{ sessionId: sessionA, entryId: entryA }, { sessionId: sessionB, entryId: entryB }] });

    const [criteriaA, criteriaB] = await Promise.all([
      owner!.scoringCriterion.create({ data: { organizationId: organizationA, competitionId: competitionA, name: "Score A", code: "SCORE", maxScore: 100 } }),
      owner!.scoringCriterion.create({ data: { organizationId: organizationB, competitionId: competitionB, name: "Score B", code: "SCORE", maxScore: 100 } }),
    ]);
    criterionA = criteriaA.id;
    await owner!.genericScoreEntry.createMany({ data: [
      { organizationId: organizationA, sessionId: sessionA, entryId: entryA, criterionId: criteriaA.id, score: 91, status: "PUBLISHED", idempotencyKey: `score-a-${suffix}` },
      { organizationId: organizationB, sessionId: sessionB, entryId: entryB, criterionId: criteriaB.id, score: 82, status: "PUBLISHED", idempotencyKey: `score-b-${suffix}` },
    ] });
    await owner!.genericResult.createMany({ data: [
      { organizationId: organizationA, competitionId: competitionA, sessionId: sessionA, scopeKey: sessionA, entryId: entryA, rank: 1, totalScore: 91, status: "PUBLISHED", publishedAt: new Date() },
      { organizationId: organizationB, competitionId: competitionB, sessionId: sessionB, scopeKey: sessionB, entryId: entryB, rank: 1, totalScore: 82, status: "PUBLISHED", publishedAt: new Date() },
    ] });
    await owner!.competitionPublication.createMany({ data: [
      { organizationId: organizationA, competitionId: competitionA, publicSlug: `p20-public-a-${suffix}`, status: "PUBLISHED", publishedAt: new Date() },
      { organizationId: organizationB, competitionId: competitionB, publicSlug: `p20-public-b-${suffix}`, status: "DRAFT" },
    ] });
  });

  afterAll(async () => {
    await runtime?.$disconnect();
    await owner?.$disconnect();
  });

  it("default-denies every Phase 19 tenant table without context", async () => {
    const counts = await Promise.all([
      runtime!.competitionParticipant.count(),
      runtime!.genericCompetitionEntry.count(),
      runtime!.competitionSession.count(),
      runtime!.competitionSessionEntry.count(),
      runtime!.scoringCriterion.count(),
      runtime!.genericScoreEntry.count(),
      runtime!.genericResult.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("isolates all generic competition records between tenant A and tenant B", async () => {
    await withTenantDatabase(runtime!, organizationA, async (tx) => {
      expect((await tx.competitionParticipant.findMany()).map((row) => row.organizationId)).toEqual([organizationA, organizationA]);
      expect((await tx.genericCompetitionEntry.findMany()).every((row) => row.organizationId === organizationA)).toBe(true);
      expect((await tx.competitionSession.findMany()).map((row) => row.id)).toEqual([sessionA]);
      expect((await tx.genericScoreEntry.findMany()).map((row) => row.organizationId)).toEqual([organizationA]);
      expect((await tx.genericResult.findMany()).map((row) => row.organizationId)).toEqual([organizationA]);
    });
    await withTenantDatabase(runtime!, organizationB, async (tx) => {
      expect((await tx.competitionParticipant.findMany()).map((row) => row.id)).toEqual([participantB]);
      expect((await tx.competitionSession.findMany()).map((row) => row.id)).toEqual([sessionB]);
    });
  });

  it("rejects cross-tenant entry and session-entry relations at the database boundary", async () => {
    await withTenantDatabase(runtime!, organizationA, async (tx) => {
      await expect(tx.genericCompetitionEntry.create({ data: {
        organizationId: organizationA,
        competitionId: competitionA,
        participantId: participantB,
        idempotencyKey: `cross-entry-${suffix}`,
      } })).rejects.toBeTruthy();
      await expect(tx.competitionSessionEntry.create({ data: { sessionId: sessionA, entryId: entryB } })).rejects.toBeTruthy();
    });
  });

  it("rejects scores and session results for participants not assigned to the session", async () => {
    await withTenantDatabase(runtime!, organizationA, async (tx) => {
      await expect(tx.genericScoreEntry.create({ data: {
        organizationId: organizationA,
        sessionId: sessionA,
        entryId: unassignedEntryA,
        criterionId: criterionA,
        score: 99,
        idempotencyKey: `unassigned-score-${suffix}`,
      } })).rejects.toBeTruthy();
      await expect(tx.genericResult.create({ data: {
        organizationId: organizationA,
        competitionId: competitionA,
        sessionId: sessionA,
        scopeKey: `invalid-${suffix}`,
        entryId: unassignedEntryA,
        totalScore: 99,
      } })).rejects.toBeTruthy();
    });
  });

  it("allows public scope only for published competition data and never exposes raw scores", async () => {
    await withPlatformDatabase(runtime!, async (tx) => {
      const participantIds = (await tx.competitionParticipant.findMany({ where: { id: { in: [participantA, unassignedParticipantA, participantB] } }, select: { id: true, name: true } })).map((row) => row.id).sort();
      const entryIds = (await tx.genericCompetitionEntry.findMany({ where: { id: { in: [entryA, unassignedEntryA, entryB] } } })).map((row) => row.id).sort();
      const sessionIds = (await tx.competitionSession.findMany({ where: { id: { in: [sessionA, sessionB] } } })).map((row) => row.id);
      const resultOrganizations = (await tx.genericResult.findMany({ where: { competitionId: { in: [competitionA, competitionB] } } })).map((row) => row.organizationId);
      expect(participantIds).toEqual([participantA, unassignedParticipantA].sort());
      expect(entryIds).toEqual([entryA, unassignedEntryA].sort());
      expect(sessionIds).toEqual([sessionA]);
      expect(resultOrganizations).toEqual([organizationA]);
      expect(await tx.genericScoreEntry.count({ where: { sessionId: { in: [sessionA, sessionB] } } })).toBe(0);
    }, "public");
  });

  it("clears tenant context after switching organizations", async () => {
    expect(await withTenantDatabase(runtime!, organizationA, (tx) => tx.genericResult.count())).toBe(1);
    expect(await withTenantDatabase(runtime!, organizationB, (tx) => tx.genericResult.count())).toBe(1);
    expect(await runtime!.genericResult.count()).toBe(0);
  });
});
