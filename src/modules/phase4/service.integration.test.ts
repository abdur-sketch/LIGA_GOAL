import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/auth/api";
import { db } from "@/lib/db";
import {
  confirmLineup,
  correctEvent,
  createEvent,
  publicMatchSnapshot,
  realtimeMessages,
  requestOfficialCorrection,
  reviewMatch,
  reviewOfficialCorrection,
  saveLineup,
  transitionMatch,
} from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId: string;
let otherOrganizationId: string;
let operatorId: string;
let approverId: string;
let matchId: string;
let homeTeamId: string;
let awayTeamId: string;
let homeRegistrations: Array<{
  id: string;
  playerId: string;
  jerseyNumber: number;
}> = [];
let awayRegistrations: Array<{
  id: string;
  playerId: string;
  jerseyNumber: number;
}> = [];
let goalEventId: string;

const operator = () => ({
  id: operatorId,
  isActive: true,
  isPlatformAdmin: false,
  deletedAt: null,
});
const approver = () => ({
  id: approverId,
  isActive: true,
  isPlatformAdmin: false,
  deletedAt: null,
});

describe.sequential("Phase 4 live match workflow", () => {
  beforeAll(async () => {
    const [organization, other] = await Promise.all([
      db.organization.create({
        data: { name: "Live Tenant", slug: `live-${suffix}`, status: "ACTIVE" },
      }),
      db.organization.create({
        data: {
          name: "Other Live Tenant",
          slug: `live-other-${suffix}`,
          status: "ACTIVE",
        },
      }),
    ]);
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const permissionKeys = [
      "match.view",
      "match.lineup.manage",
      "match.lineup.confirm",
      "match.operate",
      "match.event.correct",
      "match.finish",
      "match.official.correct",
      "match.realtime.publish",
      "match.review",
      "match.approve",
    ];
    const permissions = await Promise.all(
      permissionKeys.map((key) =>
        db.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
        }),
      ),
    );
    const operatorRole = await db.role.create({
      data: {
        organizationId,
        name: "Match Operator",
        key: `operator-${suffix}`,
        permissions: {
          create: permissions
            .filter(
              (permission) =>
                !["match.review", "match.approve"].includes(permission.key),
            )
            .map((permission) => ({ permissionId: permission.id })),
        },
      },
    });
    const approverRole = await db.role.create({
      data: {
        organizationId,
        name: "Match Approver",
        key: `approver-${suffix}`,
        permissions: {
          create: permissions
            .filter((permission) =>
              ["match.view", "match.review", "match.approve"].includes(
                permission.key,
              ),
            )
            .map((permission) => ({ permissionId: permission.id })),
        },
      },
    });
    const [operatorUser, approverUser] = await Promise.all([
      db.user.create({
        data: {
          name: "Operator",
          email: `operator-${suffix}@test.invalid`,
          passwordHash: "test",
          memberships: { create: { organizationId, roleId: operatorRole.id } },
        },
      }),
      db.user.create({
        data: {
          name: "Approver",
          email: `approver-${suffix}@test.invalid`,
          passwordHash: "test",
          memberships: { create: { organizationId, roleId: approverRole.id } },
        },
      }),
    ]);
    operatorId = operatorUser.id;
    approverId = approverUser.id;
    const competition = await db.competition.create({
      data: {
        organizationId,
        name: "Live Cup",
        slug: `live-cup-${suffix}`,
        format: "SINGLE_ELIMINATION",
        status: "ONGOING",
      },
    });
    await db.competitionRule.create({
      data: {
        competitionId: competition.id,
        key: "match_rules",
        value: {
          playersOnField: 5,
          substitutesLimit: 3,
          publicLineup: true,
          separationOfDuties: true,
        },
      },
    });
    const season = await db.season.create({
      data: {
        competitionId: competition.id,
        name: `Live ${suffix}`,
        startsAt: new Date("2026-01-01"),
        endsAt: new Date("2026-12-31"),
        status: "ACTIVE",
      },
    });
    const stage = await db.stage.create({
      data: {
        organizationId,
        seasonId: season.id,
        name: "Knockout",
        sortOrder: 1,
        type: "KNOCKOUT",
        format: "SINGLE_ELIMINATION",
        publishedAt: new Date(),
      },
    });
    const clubs = await Promise.all([
      db.club.create({
        data: {
          organizationId,
          name: "Live Home",
          shortName: "HOME",
          slug: `live-home-${suffix}`,
        },
      }),
      db.club.create({
        data: {
          organizationId,
          name: "Live Away",
          shortName: "AWAY",
          slug: `live-away-${suffix}`,
        },
      }),
    ]);
    const teams = await Promise.all(
      clubs.map((club) =>
        db.team.create({
          data: {
            competitionId: competition.id,
            clubId: club.id,
            name: club.name,
          },
        }),
      ),
    );
    homeTeamId = teams[0].id;
    awayTeamId = teams[1].id;
    for (const club of clubs)
      await db.competitionClub.create({
        data: {
          organizationId,
          competitionId: competition.id,
          seasonId: season.id,
          clubId: club.id,
          status: "APPROVED",
        },
      });
    for (const [clubIndex, club] of clubs.entries()) {
      const entries: Array<{
        id: string;
        playerId: string;
        jerseyNumber: number;
      }> = [];
      for (let index = 1; index <= 5; index += 1) {
        const player = await db.player.create({
          data: {
            organizationId,
            activeClubId: club.id,
            fullName: `${club.shortName} Player ${index}`,
            status: "ACTIVE",
            privateProfile: {
              create: {
                legalFullName: `PRIVATE ${club.shortName} ${index}`,
                address: "private-address",
              },
            },
          },
        });
        const registration = await db.playerRegistration.create({
          data: {
            organizationId,
            competitionId: competition.id,
            seasonId: season.id,
            clubId: club.id,
            playerId: player.id,
            idempotencyKey: `live-reg-${clubIndex}-${index}-${suffix}`,
            jerseyNumber: index,
            status: "APPROVED",
            verificationStatus: "VERIFIED",
            eligibilityStatus: "ELIGIBLE",
            rosterEntry: {
              create: {
                organizationId,
                seasonId: season.id,
                clubId: club.id,
                jerseyNumber: index,
                status: "ACTIVE",
              },
            },
          },
        });
        entries.push({
          id: registration.id,
          playerId: player.id,
          jerseyNumber: index,
        });
      }
      if (clubIndex === 0) homeRegistrations = entries;
      else awayRegistrations = entries;
    }
    const match = await db.match.create({
      data: {
        organizationId,
        competitionId: competition.id,
        seasonId: season.id,
        stageId: stage.id,
        homeTeamId,
        awayTeamId,
        matchNumber: 1,
        kickoffAt: new Date("2026-06-01T12:00:00Z"),
        status: "SCHEDULED",
        publishedAt: new Date(),
        createdById: operatorId,
      },
    });
    matchId = match.id;
    const nextTie = await db.bracketTie.create({
      data: {
        organizationId,
        competitionId: competition.id,
        stageId: stage.id,
        round: 2,
        position: 1,
        label: "Final",
        slots: {
          create: [
            { organizationId, side: "HOME", sourceLabel: "Winner SF1" },
            { organizationId, side: "AWAY", sourceLabel: "Winner SF2" },
          ],
        },
      },
    });
    await db.bracketTie.create({
      data: {
        organizationId,
        competitionId: competition.id,
        stageId: stage.id,
        round: 1,
        position: 1,
        label: "Semifinal",
        matchId,
        nextTieId: nextTie.id,
        nextSide: "HOME",
        slots: {
          create: [
            { organizationId, side: "HOME", clubId: clubs[0].id },
            { organizationId, side: "AWAY", clubId: clubs[1].id },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    const orgs = [organizationId, otherOrganizationId].filter(Boolean);
    await db.statisticsRevision.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.statisticsSnapshot.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.statisticsRecomputeJob.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.pointAdjustment.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.auditLog.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.matchRealtimeOutbox.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchEventRevision.deleteMany({
      where: { event: { organizationId: { in: orgs } } },
    });
    await db.matchApproval.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchCorrection.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchResult.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchEvent.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.matchClockState.deleteMany({
      where: { match: { organizationId: { in: orgs } } },
    });
    await db.matchLineupRevision.deleteMany({
      where: { lineup: { organizationId: { in: orgs } } },
    });
    await db.matchLineupPlayer.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.matchLineup.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.bracketLeg.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.bracketSlot.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.bracketTie.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.match.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.rosterEntry.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.playerPrivateProfile.deleteMany({
      where: { player: { organizationId: { in: orgs } } },
    });
    await db.playerRegistration.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.player.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.competitionClub.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.team.deleteMany({
      where: { competition: { organizationId: { in: orgs } } },
    });
    await db.stage.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.competitionRule.deleteMany({
      where: { competition: { organizationId: { in: orgs } } },
    });
    await db.season.deleteMany({
      where: { competition: { organizationId: { in: orgs } } },
    });
    await db.competition.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await db.club.deleteMany({ where: { organizationId: { in: orgs } } });
    await db.organization.deleteMany({ where: { id: { in: orgs } } });
    await db.user.deleteMany({
      where: { id: { in: [operatorId, approverId].filter(Boolean) } },
    });
  });

  it("rejects ineligible cross-team lineup entries and cross-tenant mutations", async () => {
    const players = homeRegistrations.map((entry, index) => ({
      registrationId: entry.id,
      playerId: entry.playerId,
      role: "STARTER" as const,
      shirtNumber: entry.jerseyNumber,
      isCaptain: index === 0,
      isGoalkeeper: index === 0,
    }));
    players[1] = { ...players[1], registrationId: awayRegistrations[1].id };
    await expect(
      saveLineup(operator(), organizationId, matchId, {
        teamId: homeTeamId,
        formation: "2-2",
        players,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      createEvent(operator(), otherOrganizationId, matchId, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("confirms both lineups and rejects illegal lifecycle transitions", async () => {
    const payload = (entries: typeof homeRegistrations, teamId: string) => ({
      teamId,
      formation: "2-2",
      players: entries.map((entry, index) => ({
        registrationId: entry.id,
        playerId: entry.playerId,
        role: "STARTER" as const,
        shirtNumber: entry.jerseyNumber,
        isCaptain: index === 0,
        isGoalkeeper: index === 0,
      })),
    });
    await saveLineup(
      operator(),
      organizationId,
      matchId,
      payload(homeRegistrations, homeTeamId),
    );
    await saveLineup(
      operator(),
      organizationId,
      matchId,
      payload(awayRegistrations, awayTeamId),
    );
    await confirmLineup(operator(), organizationId, matchId, homeTeamId);
    await confirmLineup(operator(), organizationId, matchId, awayTeamId);
    const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(match.status).toBe("LINEUP_CONFIRMED");
    await expect(
      transitionMatch(operator(), organizationId, matchId, {
        status: "OFFICIAL",
        expectedVersion: match.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("calculates live score from idempotent events and corrections", async () => {
    let match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    await transitionMatch(operator(), organizationId, matchId, {
      status: "LIVE_FIRST_HALF",
      expectedVersion: match.version,
    });
    match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    const goal = await createEvent(operator(), organizationId, matchId, {
      idempotencyKey: `goal-${suffix}`,
      eventType: "GOAL",
      period: "FIRST_HALF",
      teamId: homeTeamId,
      playerId: homeRegistrations[1].playerId,
      minute: 12,
      expectedVersion: match.version,
    });
    goalEventId = goal.event.id;
    expect(goal.score.home).toBe(1);
    const duplicate = await createEvent(operator(), organizationId, matchId, {
      idempotencyKey: `goal-${suffix}`,
      eventType: "GOAL",
      period: "FIRST_HALF",
      teamId: homeTeamId,
      playerId: homeRegistrations[1].playerId,
      minute: 12,
      expectedVersion: 1,
    });
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.score.home).toBe(1);
    match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    const ownGoal = await createEvent(operator(), organizationId, matchId, {
      idempotencyKey: `own-${suffix}`,
      eventType: "OWN_GOAL",
      period: "FIRST_HALF",
      teamId: homeTeamId,
      playerId: homeRegistrations[2].playerId,
      minute: 20,
      expectedVersion: match.version,
    });
    expect(ownGoal.score.away).toBe(1);
    const corrected = await correctEvent(
      operator(),
      organizationId,
      matchId,
      goal.event.id,
      { isValid: false, reason: "Goal dibatalkan setelah review VAR." },
    );
    expect(corrected.score.home).toBe(0);
    expect(
      await db.matchEventRevision.count({ where: { eventId: goal.event.id } }),
    ).toBe(1);
    match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    for (const status of [
      "HALF_TIME",
      "LIVE_SECOND_HALF",
      "EXTRA_TIME",
      "PENALTY_SHOOTOUT",
    ] as const) {
      match = await transitionMatch(operator(), organizationId, matchId, {
        status,
        expectedVersion: match.version,
      });
    }
    const shootout = await createEvent(operator(), organizationId, matchId, {
      idempotencyKey: `shootout-${suffix}`,
      eventType: "SHOOTOUT_GOAL",
      period: "PENALTY_SHOOTOUT",
      teamId: homeTeamId,
      minute: 120,
      expectedVersion: match.version,
    });
    expect(shootout.score.home).toBe(0);
    expect(shootout.score.shootoutHome).toBe(1);
  });

  it("separates operator approval and progresses bracket exactly once", async () => {
    await correctEvent(operator(), organizationId, matchId, goalEventId, {
      isValid: true,
      reason: "Goal dikembalikan setelah pemeriksaan operator.",
    });
    const match = await db.match.findUniqueOrThrow({ where: { id: matchId } });
    await transitionMatch(operator(), organizationId, matchId, {
      status: "FINISHED_PENDING_APPROVAL",
      expectedVersion: match.version,
    });
    await expect(
      reviewMatch(operator(), organizationId, matchId, { action: "approve" }),
    ).rejects.toBeInstanceOf(ApiError);
    const approved = await reviewMatch(approver(), organizationId, matchId, {
      action: "approve",
      refereeNotes: "Verified",
    });
    expect(approved.match.status).toBe("OFFICIAL");
    const completed = await db.bracketTie.findFirstOrThrow({
      where: { matchId },
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.winnerTeamId).toBe(homeTeamId);
    const nextSlot = await db.bracketSlot.findFirstOrThrow({
      where: { tieId: completed.nextTieId!, side: "HOME" },
    });
    expect(nextSlot.clubId).not.toBeNull();
    expect(await db.matchResult.count({ where: { matchId } })).toBe(1);
  });

  it("preserves official history through correction and restores realtime snapshot", async () => {
    const correction = await requestOfficialCorrection(
      operator(),
      organizationId,
      matchId,
      { reason: "Koreksi event setelah bukti video resmi diterima." },
    );
    await reviewOfficialCorrection(approver(), organizationId, correction.id, {
      action: "approve",
      notes: "Disetujui",
    });
    await correctEvent(operator(), organizationId, matchId, goalEventId, {
      minute: 13,
      reason: "Menit goal dikoreksi setelah bukti video.",
    });
    const pending = await db.match.findUniqueOrThrow({
      where: { id: matchId },
    });
    expect(pending.status).toBe("FINISHED_PENDING_APPROVAL");
    await reviewMatch(approver(), organizationId, matchId, {
      action: "approve",
    });
    expect(await db.matchResult.count({ where: { matchId } })).toBe(2);
    expect(
      await db.matchResult.count({ where: { matchId, isCurrent: true } }),
    ).toBe(1);
    const realtime = await realtimeMessages(matchId, organizationId, BigInt(0));
    expect(realtime.snapshot.topic).toBe("snapshot");
    expect(realtime.messages.length).toBeGreaterThan(0);
  });

  it("public snapshot exposes no private player profile fields", async () => {
    const snapshot = await publicMatchSnapshot(matchId);
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("private-address");
    expect(serialized).not.toContain("legalFullName");
    expect(serialized).not.toContain("idempotencyKey");
    expect(serialized).not.toContain("operatorId");
    expect(snapshot.status).toBe("OFFICIAL");
  });
});
