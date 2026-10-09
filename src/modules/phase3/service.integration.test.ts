import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  createManualFixture,
  createStage,
  generateFixturePreview,
  listPublicFixtures,
  publishGeneration,
  rescheduleFixture,
  validateGeneration,
} from "./service";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let orgA: string;
let orgB: string;
let userA: string;
let platformUser: string;
let competitionId: string;
let seasonId: string;
let stageId: string;
let venueId: string;
let refereeId: string;
let clubIds: string[] = [];
let generationId: string;
let matchId: string;
const actorA = () => ({
  id: userA,
  isActive: true,
  isPlatformAdmin: false,
  deletedAt: null,
});
const admin = () => ({
  id: platformUser,
  isActive: true,
  isPlatformAdmin: true,
  deletedAt: null,
});
const config = {
  numberOfGroups: 1,
  qualifiersPerGroup: 1,
  rounds: 1,
  homeAway: false,
  drawMethod: "SEEDED" as const,
  tieBreakers: [
    "points" as const,
    "goal_difference" as const,
    "goals_for" as const,
  ],
  knockoutLegs: 1,
  extraTime: true,
  penaltyShootout: true,
  thirdPlace: false,
  minimumRestHours: 24,
  matchDurationMinutes: 120,
  timezone: "Asia/Jakarta",
};
describe("Phase 3 fixture workflow", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([
      db.organization.create({
        data: {
          name: "Fixture Tenant A",
          slug: `fixture-a-${suffix}`,
          status: "ACTIVE",
        },
      }),
      db.organization.create({
        data: {
          name: "Fixture Tenant B",
          slug: `fixture-b-${suffix}`,
          status: "ACTIVE",
        },
      }),
    ]);
    orgA = a.id;
    orgB = b.id;
    const permissions = await Promise.all(
      [
        "fixture.view",
        "fixture.generate",
        "fixture.create",
        "fixture.reschedule",
      ].map((key) =>
        db.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
        }),
      ),
    );
    const role = await db.role.create({
      data: {
        organizationId: orgA,
        name: "Scheduler",
        key: `scheduler-${suffix}`,
        permissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
    });
    const [user, root] = await Promise.all([
      db.user.create({
        data: {
          name: "Scheduler",
          email: `scheduler-${suffix}@test.invalid`,
          passwordHash: "test",
          memberships: { create: { organizationId: orgA, roleId: role.id } },
        },
      }),
      db.user.create({
        data: {
          name: "Platform",
          email: `platform-${suffix}@test.invalid`,
          passwordHash: "test",
          isPlatformAdmin: true,
        },
      }),
    ]);
    userA = user.id;
    platformUser = root.id;
    const competition = await db.competition.create({
      data: {
        organizationId: orgA,
        name: "Fixture League",
        slug: `fixture-${suffix}`,
        format: "SINGLE_ROUND_ROBIN",
        status: "REGISTRATION",
      },
    });
    competitionId = competition.id;
    const season = await db.season.create({
      data: {
        competitionId,
        name: "2026",
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        status: "ACTIVE",
      },
    });
    seasonId = season.id;
    const stage = await db.stage.create({
      data: {
        organizationId: orgA,
        seasonId,
        name: "League",
        sortOrder: 1,
        type: "ROUND_ROBIN",
        format: "SINGLE_ROUND_ROBIN",
      },
    });
    stageId = stage.id;
    const clubs = await Promise.all(
      [1, 2, 3, 4].map((index) =>
        db.club.create({
          data: {
            organizationId: orgA,
            name: `Club ${index}`,
            shortName: `C${index}`,
            slug: `fixture-club-${index}-${suffix}`,
          },
        }),
      ),
    );
    clubIds = clubs.map((club) => club.id);
    for (const clubId of clubIds)
      await db.competitionClub.create({
        data: {
          organizationId: orgA,
          competitionId,
          seasonId,
          clubId,
          status: "APPROVED",
        },
      });
    venueId = (
      await db.venue.create({
        data: {
          organizationId: orgA,
          name: "Fixture Stadium",
          status: "AVAILABLE",
        },
      })
    ).id;
    refereeId = (
      await db.official.create({
        data: {
          organizationId: orgA,
          fullName: "Fixture Referee",
          email: `ref-${suffix}@test.invalid`,
        },
      })
    ).id;
  });
  afterAll(async () => {
    const orgs = [orgA, orgB];
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.bracketSlot.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.bracketTie.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.matchScheduleHistory.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchOfficialAssignment.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchEvent.deleteMany({
      where: { match: { organizationId: { in: orgs } } },
    });
    await db.match.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.fixturePublication.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.fixtureDraft.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.fixtureGeneration.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.groupMembership.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.group.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.stage.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.team.deleteMany({
      where: { competition: { organizationId: { in: orgs } } },
    });
    await db.competitionClub.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.official.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.venue.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.season.deleteMany({
      where: { competition: { organizationId: { in: orgs } } },
    });
    await db.club.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.competition.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.organizationMember.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.role.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.user.deleteMany({ where: { id: { in: [userA, platformUser] } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.$disconnect();
  });
  it("rejects a club that is not registered in the tenant season", async () => {
    const foreign = await db.club.create({
      data: {
        organizationId: orgB,
        name: "Foreign",
        shortName: "FOR",
        slug: `foreign-${suffix}`,
      },
    });
    await expect(
      generateFixturePreview(admin(), orgA, {
        competitionId,
        seasonId,
        stageId,
        idempotencyKey: `foreign-${suffix}`,
        format: "SINGLE_ROUND_ROBIN",
        drawMethod: "SEEDED",
        clubIds: [...clubIds.slice(0, 3), foreign.id],
        kickoffStart: "2026-05-01T10:00:00.000Z",
        daysBetweenRounds: 7,
        venueIds: [venueId],
        refereeIds: [refereeId],
        config,
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("previews six matches, validates, and publishes idempotently", async () => {
    const generation = await generateFixturePreview(admin(), orgA, {
      competitionId,
      seasonId,
      stageId,
      idempotencyKey: `generation-${suffix}`,
      format: "SINGLE_ROUND_ROBIN",
      drawMethod: "SEEDED",
      clubIds,
      kickoffStart: "2026-05-01T10:00:00.000Z",
      daysBetweenRounds: 7,
      venueIds: [venueId],
      refereeIds: [refereeId],
      config,
    });
    generationId = generation.id;
    expect(generation.drafts).toHaveLength(6);
    const validation = await validateGeneration(admin(), orgA, generationId);
    expect(validation.status).toBe("VALIDATED");
    await expect(
      publishGeneration(actorA(), orgA, generationId, {
        idempotencyKey: `publish-denied-${suffix}`,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const first = await publishGeneration(admin(), orgA, generationId, {
      idempotencyKey: `publish-${suffix}`,
    });
    const repeated = await publishGeneration(admin(), orgA, generationId, {
      idempotencyKey: `publish-${suffix}`,
    });
    expect(repeated?.id).toBe(first?.id);
    expect(
      await db.match.count({ where: { fixtureDraft: { generationId } } }),
    ).toBe(6);
    matchId = (
      await db.match.findFirstOrThrow({
        where: { fixtureDraft: { generationId } },
      })
    ).id;
  });
  it("records reschedule history and keeps published fixtures public", async () => {
    await rescheduleFixture(actorA(), orgA, matchId, {
      kickoffAt: "2026-08-01T10:00:00.000Z",
      venueId,
      refereeId,
      timezone: "Asia/Jakarta",
      reason: "Operational adjustment",
    });
    expect(
      await db.matchScheduleHistory.count({
        where: { matchId, action: "RESCHEDULE" },
      }),
    ).toBe(1);
    expect(
      (await listPublicFixtures(orgA)).some((match) => match.id === matchId),
    ).toBe(true);
  });
  it("keeps manual drafts out of the public schedule", async () => {
    const draft = await createManualFixture(actorA(), orgA, {
      competitionId,
      seasonId,
      stageId,
      homeClubId: clubIds[0],
      awayClubId: clubIds[1],
      venueId: null,
      refereeId: null,
      kickoffAt: null,
      timezone: "Asia/Jakarta",
    });
    expect(
      (await listPublicFixtures(orgA)).some((match) => match.id === draft.id),
    ).toBe(false);
  });
  it("denies cross-tenant mutations", async () => {
    await expect(
      createStage(actorA(), orgB, {
        seasonId,
        name: "Intrusion",
        sortOrder: 1,
        type: "ROUND_ROBIN",
        format: "SINGLE_ROUND_ROBIN",
        settings: {},
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
