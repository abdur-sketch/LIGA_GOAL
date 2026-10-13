import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rootDb } from "@/lib/db";
import { withTenantDatabase } from "@/lib/tenant-db";
import { createEvent } from "@/modules/phase4/service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const enabled = process.env.PHASE11_CONCURRENT_WRITE_TEST === "1" && ownerUrl;
const owner = ownerUrl
  ? new PrismaClient({ datasources: { db: { url: ownerUrl } } })
  : null;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId = "";
let actorId = "";
let matchId = "";
let competitionId = "";
let seasonId = "";
let stageId = "";
let homeTeamId = "";
let awayTeamId = "";
let homeClubId = "";
let awayClubId = "";

describe.skipIf(!enabled)("Phase 11 concurrent match operators", () => {
  beforeAll(async () => {
    const organization = await owner!.organization.create({
      data: { name: "Concurrent Operator Tenant", slug: `concurrent-${suffix}`, status: "ACTIVE" },
    });
    organizationId = organization.id;
    actorId = (
      await owner!.user.create({
        data: {
          name: "Phase 11 Concurrent Operator",
          email: `phase11-operator-${suffix}@test.invalid`,
          passwordHash: "test",
          isPlatformAdmin: true,
        },
      })
    ).id;
    const competition = await owner!.competition.create({
      data: { organizationId, name: "Concurrent Operator League", slug: `concurrent-league-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "ONGOING" },
    });
    competitionId = competition.id;
    const season = await owner!.season.create({
      data: { competitionId, name: `Concurrent 2026 ${suffix}`, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), status: "ACTIVE", isActive: true },
    });
    seasonId = season.id;
    const stage = await owner!.stage.create({
      data: { organizationId, seasonId, name: "Concurrent Stage", sortOrder: 1, type: "ROUND_ROBIN", format: "SINGLE_ROUND_ROBIN" },
    });
    stageId = stage.id;
    const [homeClub, awayClub] = await Promise.all([
      owner!.club.create({ data: { organizationId, name: "Concurrent Home", shortName: "CHM", slug: `concurrent-home-${suffix}` } }),
      owner!.club.create({ data: { organizationId, name: "Concurrent Away", shortName: "CAW", slug: `concurrent-away-${suffix}` } }),
    ]);
    homeClubId = homeClub.id;
    awayClubId = awayClub.id;
    const [homeTeam, awayTeam] = await Promise.all([
      owner!.team.create({ data: { competitionId, clubId: homeClubId, name: homeClub.name } }),
      owner!.team.create({ data: { competitionId, clubId: awayClubId, name: awayClub.name } }),
    ]);
    homeTeamId = homeTeam.id;
    awayTeamId = awayTeam.id;
    matchId = (
      await owner!.match.create({
        data: { organizationId, competitionId, seasonId, stageId, homeTeamId, awayTeamId, matchNumber: 1, kickoffAt: new Date("2026-10-13T12:00:00Z"), status: "LIVE_FIRST_HALF", version: 1, publishedAt: new Date() },
      })
    ).id;
  });

  afterAll(async () => {
    await rootDb.$disconnect();
    await owner!.auditLog.deleteMany({ where: { actorId } });
    await owner!.matchRealtimeOutbox.deleteMany({ where: { matchId } });
    await owner!.matchEvent.deleteMany({ where: { matchId } });
    await owner!.match.delete({ where: { id: matchId } });
    await owner!.team.deleteMany({ where: { id: { in: [homeTeamId, awayTeamId] } } });
    await owner!.club.deleteMany({ where: { id: { in: [homeClubId, awayClubId] } } });
    await owner!.stage.delete({ where: { id: stageId } });
    await owner!.season.delete({ where: { id: seasonId } });
    await owner!.competition.delete({ where: { id: competitionId } });
    await owner!.organization.delete({ where: { id: organizationId } });
    await owner!.user.delete({ where: { id: actorId } });
    await owner!.$disconnect();
  });

  it("preserves optimistic concurrency and idempotency under the runtime role", async () => {
    const actor = {
      id: actorId,
      isActive: true,
      isPlatformAdmin: true,
      deletedAt: null,
    };
    const input = (key: string, expectedVersion: number) => ({
      idempotencyKey: key,
      eventType: "KICK_OFF" as const,
      period: "FIRST_HALF" as const,
      minute: 0,
      expectedVersion,
    });
    const keys = [`phase11-write-a-${suffix}`, `phase11-write-b-${suffix}`];
    const first = await Promise.allSettled(
      keys.map((key) =>
        withTenantDatabase(rootDb, organizationId, () =>
          createEvent(actor, organizationId, matchId, input(key, 1)),
        ),
      ),
    );
    expect(
      first.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(first.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    expect(await owner!.matchEvent.count({ where: { matchId } })).toBe(1);

    const failedIndex = first.findIndex(
      (result) => result.status === "rejected",
    );
    const current = await owner!.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { version: true },
    });
    const retry = await withTenantDatabase(rootDb, organizationId, () =>
      createEvent(
        actor,
        organizationId,
        matchId,
        input(keys[failedIndex], current.version),
      ),
    );
    expect(retry.duplicate).toBe(false);
    const replay = await withTenantDatabase(rootDb, organizationId, () =>
      createEvent(actor, organizationId, matchId, input(keys[failedIndex], 1)),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.event.id).toBe(retry.event.id);
    expect(await owner!.matchEvent.count({ where: { matchId } })).toBe(2);
  });
});
