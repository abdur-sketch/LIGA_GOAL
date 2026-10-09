import { beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/auth/api";
import { db } from "@/lib/db";
import {
  createPointAdjustment,
  getStatistics,
  publicStatistics,
  recomputeStatistics,
} from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId = "";
let otherOrganizationId = "";
let competitionId = "";
let seasonId = "";
let stageId = "";
let homeClubId = "";
let actorId = "";

const actor = () => ({ id: actorId, isActive: true, isPlatformAdmin: false, deletedAt: null });

describe.sequential("Phase 5 official statistics workflow", () => {
  beforeAll(async () => {
    const [organization, other] = await Promise.all([
      db.organization.create({ data: { name: "Stats Tenant", slug: `stats-${suffix}`, status: "ACTIVE" } }),
      db.organization.create({ data: { name: "Other Stats Tenant", slug: `stats-other-${suffix}`, status: "ACTIVE" } }),
    ]);
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const permissionKeys = ["standings.view", "standings.recompute", "standings.adjust", "statistics.view", "statistics.recompute", "statistics.export", "leaderboard.view"];
    const permissions = await Promise.all(permissionKeys.map((key) => db.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    const role = await db.role.create({ data: { organizationId, name: "Statistician", key: `stats-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
    const user = await db.user.create({ data: { name: "Statistician", email: `stats-${suffix}@test.invalid`, passwordHash: "test", memberships: { create: { organizationId, roleId: role.id } } } });
    actorId = user.id;
    const competition = await db.competition.create({ data: { organizationId, name: "Stats League", slug: `stats-league-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "ONGOING" } });
    competitionId = competition.id;
    const season = await db.season.create({ data: { competitionId, name: `2026-${suffix}`, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), status: "ACTIVE", isActive: true } });
    seasonId = season.id;
    const stage = await db.stage.create({ data: { organizationId, seasonId, name: "League", sortOrder: 1, type: "ROUND_ROBIN", format: "SINGLE_ROUND_ROBIN" } });
    stageId = stage.id;
    const [home, away] = await Promise.all([
      db.club.create({ data: { organizationId, name: "Home FC", shortName: "HOM", slug: `home-${suffix}` } }),
      db.club.create({ data: { organizationId, name: "Away FC", shortName: "AWY", slug: `away-${suffix}` } }),
    ]);
    homeClubId = home.id;
    for (const club of [home, away]) await db.competitionClub.create({ data: { organizationId, competitionId, seasonId, clubId: club.id, status: "APPROVED" } });
    const [homeTeam, awayTeam] = await Promise.all([
      db.team.create({ data: { competitionId, clubId: home.id, name: home.name } }),
      db.team.create({ data: { competitionId, clubId: away.id, name: away.name } }),
    ]);
    const player = await db.player.create({ data: { organizationId, activeClubId: away.id, fullName: "Historical Player", privateProfile: { create: { legalFullName: "Private Legal Name", address: "Secret Address" } } } });
    const registration = await db.playerRegistration.create({ data: { organizationId, competitionId, seasonId, clubId: home.id, playerId: player.id, idempotencyKey: `reg-${suffix}`, status: "APPROVED" } });
    const match = await db.match.create({ data: { organizationId, competitionId, seasonId, stageId, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id, matchNumber: 1, status: "OFFICIAL", homeScore: 2, awayScore: 0, publishedAt: new Date() } });
    await db.matchResult.create({ data: { organizationId, matchId: match.id, version: 1, homeScore: 2, awayScore: 0, winnerTeamId: homeTeam.id, eventSnapshot: [] } });
    const lineup = await db.matchLineup.create({ data: { organizationId, matchId: match.id, teamId: homeTeam.id, formation: "4-3-3", status: "CONFIRMED", confirmedById: user.id, players: { create: { organizationId, matchId: match.id, teamId: homeTeam.id, playerId: player.id, registrationId: registration.id, role: "STARTER", shirtNumber: 9 } } } });
    expect(lineup.status).toBe("CONFIRMED");
    await db.matchEvent.create({ data: { organizationId, matchId: match.id, idempotencyKey: `goal-${suffix}`, eventType: "GOAL", period: "FIRST_HALF", teamId: homeTeam.id, playerId: player.id, minute: 10, isValid: true, operatorId: user.id } });
  });

  it("recomputes atomically and idempotently from official sources", async () => {
    const input = { organizationId, competitionId, seasonId, stageId, idempotencyKey: `build-${suffix}` };
    const first = await recomputeStatistics(actor(), input);
    const second = await recomputeStatistics(actor(), input);
    expect(first.version).toBe(1);
    expect(second.version).toBe(1);
    expect(first.standings.find((row) => row.clubId === homeClubId)).toMatchObject({ points: 3, goalsFor: 2 });
    expect(first.playerStatistics[0]).toMatchObject({ clubId: homeClubId, goals: 1 });
  });

  it("audits point deduction and publishes it only after recompute", async () => {
    await createPointAdjustment(actor(), { organizationId, competitionId, seasonId, stageId, clubId: homeClubId, amount: -4, reason: "Keputusan disipliner final", effectiveAt: new Date() });
    const snapshot = await recomputeStatistics(actor(), { organizationId, competitionId, seasonId, stageId, idempotencyKey: `adjusted-${suffix}` });
    expect(snapshot.standings.find((row) => row.clubId === homeClubId)).toMatchObject({ goalsFor: 2, rawPoints: 3, points: -1 });
  });

  it("rejects cross-tenant reads and never exposes private player identity", async () => {
    await expect(getStatistics(actor(), { organizationId: otherOrganizationId, competitionId, seasonId, stageId })).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    const publicData = await publicStatistics({ organizationId, competitionId, seasonId, stageId });
    expect(JSON.stringify(publicData)).not.toContain("Private Legal Name");
    expect(JSON.stringify(publicData)).not.toContain("Secret Address");
  });
});
