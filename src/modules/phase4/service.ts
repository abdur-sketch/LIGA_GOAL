import { Prisma, type MatchStatus } from "@prisma/client";
import {
  ApiError,
  authorizeOrganization,
  capabilities,
  getApiActor,
} from "@/lib/auth/api";
import { db } from "@/lib/db";
import { assertTransition, transitionsFrom } from "./lifecycle";
import { validateLineup } from "./lineup";
import { aggregateLegScores, calculateScore, determineWinner } from "./score";
import { recomputeStatisticsFromOfficialResult } from "@/modules/phase5/service";
import { eligibilityAt } from "@/modules/phase6/eligibility";
import {
  reconcileDiscipline,
  serveSuspensionsForOfficialMatch,
} from "@/modules/phase6/service";
import {
  correctionRequestSchema,
  correctionReviewSchema,
  eventCorrectionSchema,
  eventSchema,
  lineupSchema,
  reviewSchema,
  transitionSchema,
} from "./validation";

export type Actor = Awaited<ReturnType<typeof getApiActor>>;
export type Phase4Query = {
  organizationId: string;
  search: string;
  status?: string;
  page: number;
  pageSize: number;
};

const matchInclude = {
  competition: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, type: true } },
  venue: { select: { id: true, name: true } },
  homeTeam: {
    include: { club: { select: { id: true, name: true, logoUrl: true } } },
  },
  awayTeam: {
    include: { club: { select: { id: true, name: true, logoUrl: true } } },
  },
} satisfies Prisma.MatchInclude;

const snapshotInclude = {
  ...matchInclude,
  lineups: {
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              displayName: true,
              photoUrl: true,
              primaryPosition: true,
            },
          },
        },
        orderBy: [{ role: "asc" as const }, { shirtNumber: "asc" as const }],
      },
      revisions: { orderBy: { version: "desc" as const }, take: 10 },
    },
  },
  events: {
    where: { isValid: true },
    include: {
      player: { select: { id: true, fullName: true, displayName: true } },
      relatedPlayer: {
        select: { id: true, fullName: true, displayName: true },
      },
      team: { select: { id: true, name: true } },
    },
    orderBy: [
      { minute: "asc" as const },
      { addedTime: "asc" as const },
      { createdAt: "asc" as const },
    ],
  },
  clockState: true,
  results: { orderBy: { version: "desc" as const } },
  approvals: { orderBy: { createdAt: "desc" as const }, take: 20 },
  corrections: { orderBy: { createdAt: "desc" as const }, take: 20 },
} satisfies Prisma.MatchInclude;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT",
  resourceType: string,
  resourceId: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      organizationId,
      action,
      resourceType,
      resourceId,
      before: before == null ? Prisma.JsonNull : json(before),
      after: after == null ? Prisma.JsonNull : json(after),
    },
  });
}

async function outbox(
  tx: Prisma.TransactionClient,
  organizationId: string,
  matchId: string,
  topic: string,
  payload: unknown,
) {
  await tx.matchRealtimeOutbox.create({
    data: { organizationId, matchId, topic, payload: json(payload) },
  });
}

async function scopedMatch(organizationId: string, matchId: string) {
  const match = await db.match.findFirst({
    where: { id: matchId, organizationId },
    include: matchInclude,
  });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return match;
}

async function rules(competitionId: string) {
  const rule = await db.competitionRule.findUnique({
    where: { competitionId_key: { competitionId, key: "match_rules" } },
  });
  const value = (rule?.value || {}) as Record<string, unknown>;
  return {
    playersOnField: [5, 7, 9, 11].includes(Number(value.playersOnField))
      ? Number(value.playersOnField)
      : 11,
    substitutesLimit: Math.min(
      20,
      Math.max(0, Number(value.substitutesLimit) || 12),
    ),
    publicLineup: value.publicLineup !== false,
    separationOfDuties: value.separationOfDuties === true,
  };
}

export async function listMatches(actor: Actor, query: Phase4Query) {
  await authorizeOrganization(actor, query.organizationId, "match.view");
  const where: Prisma.MatchWhereInput = {
    organizationId: query.organizationId,
    publishedAt: { not: null },
    ...(query.status ? { status: query.status as MatchStatus } : {}),
    ...(query.search
      ? {
          OR: [
            {
              homeTeam: {
                club: { name: { contains: query.search, mode: "insensitive" } },
              },
            },
            {
              awayTeam: {
                club: { name: { contains: query.search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
  const [data, total, caps] = await Promise.all([
    db.match.findMany({
      where,
      include: matchInclude,
      orderBy: [{ kickoffAt: "desc" }, { matchNumber: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.match.count({ where }),
    capabilities(actor, query.organizationId, [
      "match.view",
      "match.lineup.manage",
      "match.lineup.confirm",
      "match.operate",
      "match.review",
      "match.approve",
    ]),
  ]);
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    capabilities: caps,
  };
}

export async function getMatchSnapshot(
  actor: Actor,
  organizationId: string,
  matchId: string,
) {
  await authorizeOrganization(actor, organizationId, "match.view");
  const match = await db.match.findFirst({
    where: { id: matchId, organizationId },
    include: snapshotInclude,
  });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  const caps = await capabilities(actor, organizationId, [
    "match.lineup.manage",
    "match.lineup.confirm",
    "match.operate",
    "match.event.correct",
    "match.finish",
    "match.review",
    "match.approve",
    "match.official.correct",
  ]);
  return {
    ...match,
    availableTransitions: transitionsFrom(match.status),
    _capabilities: caps,
    _rules: await rules(match.competitionId),
  };
}

export async function eligiblePlayers(
  actor: Actor,
  organizationId: string,
  matchId: string,
  teamId: string,
) {
  await authorizeOrganization(actor, organizationId, "match.view");
  const match = await scopedMatch(organizationId, matchId);
  const team =
    teamId === match.homeTeamId
      ? match.homeTeam
      : teamId === match.awayTeamId
        ? match.awayTeam
        : null;
  if (!team) throw new ApiError(400, "Tim tidak mengikuti pertandingan ini.");
  const registrations = await db.playerRegistration.findMany({
    where: {
      organizationId,
      seasonId: match.seasonId,
      clubId: team.clubId,
      status: "APPROVED",
      eligibilityStatus: "ELIGIBLE",
      rosterEntry: { status: "ACTIVE" },
      player: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      jerseyNumber: true,
      player: {
        select: {
          id: true,
          fullName: true,
          displayName: true,
          primaryPosition: true,
          photoUrl: true,
        },
      },
    },
    orderBy: { player: { fullName: "asc" } },
  });
  const checks = await Promise.all(
    registrations.map((registration) =>
      eligibilityAt(
        organizationId,
        registration.player.id,
        match.seasonId,
        team.clubId,
        match.kickoffAt,
      ),
    ),
  );
  return registrations.filter((_, index) => checks[index]?.result === "ELIGIBLE");
}

export async function saveLineup(
  actor: Actor,
  organizationId: string,
  matchId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "match.lineup.manage");
  const data = lineupSchema.parse(input);
  const match = await scopedMatch(organizationId, matchId);
  if (!["SCHEDULED", "LINEUP_CONFIRMED"].includes(match.status))
    throw new ApiError(
      409,
      "Lineup hanya dapat diubah sebelum pertandingan dimulai.",
    );
  const team =
    data.teamId === match.homeTeamId
      ? match.homeTeam
      : data.teamId === match.awayTeamId
        ? match.awayTeam
        : null;
  if (!team) throw new ApiError(400, "Tim tidak mengikuti pertandingan ini.");
  const registrations = await db.playerRegistration.findMany({
    where: {
      id: { in: data.players.map((item) => item.registrationId) },
      organizationId,
      seasonId: match.seasonId,
    },
    select: {
      id: true,
      playerId: true,
      clubId: true,
      status: true,
      eligibilityStatus: true,
    },
  });
  const byId = new Map(registrations.map((item) => [item.id, item]));
  const eligibility = new Map(
    await Promise.all(
      data.players.map(async (item) => [
        item.playerId,
        await eligibilityAt(
          organizationId,
          item.playerId,
          match.seasonId,
          team.clubId,
          match.kickoffAt,
        ),
      ] as const),
    ),
  );
  const matchRules = await rules(match.competitionId);
  const candidates = data.players.map((item) => {
    const registration = byId.get(item.registrationId);
    return {
      ...item,
      teamId: data.teamId,
      eligible:
        registration?.playerId === item.playerId &&
        registration.clubId === team.clubId &&
        registration.status === "APPROVED" &&
        registration.eligibilityStatus === "ELIGIBLE" &&
        eligibility.get(item.playerId)?.result === "ELIGIBLE",
    };
  });
  const errors = validateLineup(
    candidates,
    data.teamId,
    matchRules.playersOnField,
    matchRules.substitutesLimit,
  );
  if (errors.length) throw new ApiError(422, "Lineup tidak valid.", errors);
  return db.$transaction(
    async (tx) => {
      const previous = await tx.matchLineup.findUnique({
        where: { matchId_teamId: { matchId, teamId: data.teamId } },
        include: { players: true },
      });
      if (previous?.status === "CONFIRMED" && !data.reason)
        throw new ApiError(
          422,
          "Alasan revisi lineup yang telah dikonfirmasi wajib diisi.",
        );
      const version = (previous?.version || 0) + 1;
      const lineup = await tx.matchLineup.upsert({
        where: { matchId_teamId: { matchId, teamId: data.teamId } },
        update: {
          formation: data.formation,
          status: "DRAFT",
          version,
          confirmedAt: null,
          confirmedById: null,
        },
        create: {
          organizationId,
          matchId,
          teamId: data.teamId,
          formation: data.formation,
          version,
        },
      });
      await tx.matchLineupPlayer.deleteMany({ where: { lineupId: lineup.id } });
      await tx.matchLineupPlayer.createMany({
        data: data.players.map((item) => ({
          organizationId,
          matchId,
          lineupId: lineup.id,
          teamId: data.teamId,
          playerId: item.playerId,
          registrationId: item.registrationId,
          role: item.role,
          shirtNumber: item.shirtNumber,
          position: item.position,
          isCaptain: item.isCaptain,
          isGoalkeeper: item.isGoalkeeper,
        })),
      });
      await tx.matchLineupRevision.create({
        data: {
          lineupId: lineup.id,
          version,
          actorId: actor.id,
          snapshot: json(data),
          reason: data.reason,
        },
      });
      await audit(
        tx,
        actor,
        organizationId,
        previous ? "UPDATE" : "CREATE",
        "MatchLineup",
        lineup.id,
        previous,
        data,
      );
      await outbox(tx, organizationId, matchId, "lineup.updated", {
        teamId: data.teamId,
        version,
      });
      return lineup;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function assertCurrentLineupEligibility(
  organizationId: string,
  match: Awaited<ReturnType<typeof scopedMatch>>,
  teamId?: string,
) {
  const lineups = await db.matchLineup.findMany({
    where: { matchId: match.id, organizationId, ...(teamId ? { teamId } : {}) },
    include: { players: true },
  });
  for (const lineup of lineups) {
    const team = lineup.teamId === match.homeTeamId ? match.homeTeam : lineup.teamId === match.awayTeamId ? match.awayTeam : null;
    if (!team) throw new ApiError(422, "Lineup bukan milik tim pertandingan.");
    const checks = await Promise.all(
      lineup.players.map(async (player) => ({
        playerId: player.playerId,
        check: await eligibilityAt(
          organizationId,
          player.playerId,
          match.seasonId,
          team.clubId,
          match.kickoffAt,
        ),
      })),
    );
    const invalid = checks.filter((item) => item.check.result !== "ELIGIBLE");
    if (invalid.length)
      throw new ApiError(422, "Lineup memuat pemain yang tidak eligible pada waktu kickoff.", invalid);
  }
}

export async function confirmLineup(
  actor: Actor,
  organizationId: string,
  matchId: string,
  teamId: string,
) {
  await authorizeOrganization(actor, organizationId, "match.lineup.confirm");
  const match = await scopedMatch(organizationId, matchId);
  await assertCurrentLineupEligibility(organizationId, match, teamId);
  return db.$transaction(async (tx) => {
    const lineup = await tx.matchLineup.findFirst({
      where: { matchId, teamId, organizationId },
      include: { players: true },
    });
    if (!lineup) throw new ApiError(404, "Lineup belum dibuat.");
    const updated = await tx.matchLineup.update({
      where: { id: lineup.id },
      data: {
        status: "CONFIRMED",
        confirmedById: actor.id,
        confirmedAt: new Date(),
      },
    });
    const confirmed = await tx.matchLineup.count({
      where: { matchId, status: "CONFIRMED" },
    });
    if (confirmed === 2)
      await tx.match.updateMany({
        where: { id: matchId, status: "SCHEDULED" },
        data: {
          status: "LINEUP_CONFIRMED",
          version: { increment: 1 },
          updatedById: actor.id,
        },
      });
    await audit(
      tx,
      actor,
      organizationId,
      "APPROVE",
      "MatchLineup",
      lineup.id,
      lineup,
      updated,
    );
    await outbox(tx, organizationId, matchId, "lineup.confirmed", { teamId });
    return updated;
  });
}

function periodForStatus(status: MatchStatus) {
  const map: Partial<
    Record<MatchStatus, Prisma.MatchClockStateUncheckedCreateInput["period"]>
  > = {
    LIVE_FIRST_HALF: "FIRST_HALF",
    HALF_TIME: "HALF_TIME",
    LIVE_SECOND_HALF: "SECOND_HALF",
    EXTRA_TIME: "EXTRA_TIME_FIRST",
    PENALTY_SHOOTOUT: "PENALTY_SHOOTOUT",
    FINISHED_PENDING_APPROVAL: "FULL_TIME",
    OFFICIAL: "FULL_TIME",
  };
  return map[status] || "PRE_MATCH";
}

export async function transitionMatch(
  actor: Actor,
  organizationId: string,
  matchId: string,
  input: unknown,
) {
  const data = transitionSchema.parse(input);
  if (data.status === "OFFICIAL")
    throw new ApiError(409, "Hasil resmi hanya melalui workflow approval.");
  const permission =
    data.status === "FINISHED_PENDING_APPROVAL"
      ? "match.finish"
      : "match.operate";
  await authorizeOrganization(actor, organizationId, permission);
  const before = await scopedMatch(organizationId, matchId);
  try {
    assertTransition(before.status, data.status);
  } catch (error) {
    throw new ApiError(409, (error as Error).message);
  }
  if (data.status === "LIVE_FIRST_HALF") {
    const confirmed = await db.matchLineup.count({
      where: { matchId, status: "CONFIRMED" },
    });
    if (confirmed !== 2)
      throw new ApiError(422, "Kedua lineup harus dikonfirmasi.");
    await assertCurrentLineupEligibility(organizationId, before);
  }
  if (["EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(data.status)) {
    const formatRule = await db.competitionRule.findUnique({
      where: {
        competitionId_key: {
          competitionId: before.competitionId,
          key: "fixture_format",
        },
      },
    });
    const format = (formatRule?.value || {}) as Record<string, unknown>;
    if (data.status === "EXTRA_TIME" && format.extraTime === false)
      throw new ApiError(422, "Extra time tidak diaktifkan dalam regulasi.");
    if (data.status === "PENALTY_SHOOTOUT" && format.penaltyShootout === false)
      throw new ApiError(
        422,
        "Penalty shootout tidak diaktifkan dalam regulasi.",
      );
  }
  return db.$transaction(
    async (tx) => {
      const changed = await tx.match.updateMany({
        where: {
          id: matchId,
          organizationId,
          version: data.expectedVersion,
          status: before.status,
        },
        data: {
          status: data.status,
          version: { increment: 1 },
          updatedById: actor.id,
        },
      });
      if (!changed.count)
        throw new ApiError(
          409,
          "Pertandingan telah berubah. Muat ulang snapshot.",
        );
      const period = periodForStatus(data.status);
      const running = [
        "LIVE_FIRST_HALF",
        "LIVE_SECOND_HALF",
        "EXTRA_TIME",
        "PENALTY_SHOOTOUT",
      ].includes(data.status);
      await tx.matchClockState.upsert({
        where: { matchId },
        update: {
          period,
          running,
          startedAt: running ? new Date() : null,
          version: { increment: 1 },
        },
        create: {
          matchId,
          period,
          running,
          startedAt: running ? new Date() : null,
        },
      });
      await audit(
        tx,
        actor,
        organizationId,
        "UPDATE",
        "Match",
        matchId,
        { status: before.status },
        { status: data.status },
      );
      await outbox(tx, organizationId, matchId, "match.status", {
        status: data.status,
        period,
      });
      return tx.match.findUniqueOrThrow({ where: { id: matchId } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function recomputeScore(tx: Prisma.TransactionClient, matchId: string) {
  const match = await tx.match.findUniqueOrThrow({
    where: { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  });
  const events = await tx.matchEvent.findMany({
    where: { matchId },
    select: { eventType: true, teamId: true, isValid: true },
  });
  const score = calculateScore(events, match.homeTeamId, match.awayTeamId);
  await tx.match.update({
    where: { id: matchId },
    data: {
      homeScore: score.home,
      awayScore: score.away,
      shootoutHome: score.shootoutHome,
      shootoutAway: score.shootoutAway,
    },
  });
  return score;
}

export async function createEvent(
  actor: Actor,
  organizationId: string,
  matchId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "match.operate");
  const data = eventSchema.parse(input);
  const match = await scopedMatch(organizationId, matchId);
  if (
    ![
      "LIVE_FIRST_HALF",
      "HALF_TIME",
      "LIVE_SECOND_HALF",
      "EXTRA_TIME",
      "PENALTY_SHOOTOUT",
    ].includes(match.status)
  )
    throw new ApiError(409, "Pertandingan tidak sedang berlangsung.");
  if (
    ["SHOOTOUT_GOAL", "SHOOTOUT_MISSED"].includes(data.eventType) &&
    match.status !== "PENALTY_SHOOTOUT"
  )
    throw new ApiError(
      409,
      "Event penalty shootout hanya dapat dicatat pada fase adu penalti.",
    );
  if (
    data.teamId &&
    ![match.homeTeamId, match.awayTeamId].includes(data.teamId)
  )
    throw new ApiError(400, "Tim event tidak mengikuti pertandingan ini.");
  if (data.playerId || data.relatedPlayerId) {
    const players = await db.matchLineupPlayer.count({
      where: {
        matchId,
        ...(data.teamId ? { teamId: data.teamId } : {}),
        playerId: {
          in: [data.playerId, data.relatedPlayerId].filter(Boolean) as string[],
        },
        lineup: { status: "CONFIRMED" },
      },
    });
    if (
      players !==
      new Set([data.playerId, data.relatedPlayerId].filter(Boolean)).size
    )
      throw new ApiError(
        422,
        "Pemain event tidak terdapat pada lineup terkonfirmasi.",
      );
  }
  return db.$transaction(
    async (tx) => {
      const existing = await tx.matchEvent.findUnique({
        where: {
          matchId_idempotencyKey: {
            matchId,
            idempotencyKey: data.idempotencyKey,
          },
        },
      });
      if (existing)
        return {
          event: existing,
          score: await recomputeScore(tx, matchId),
          duplicate: true,
        };
      const changed = await tx.match.updateMany({
        where: { id: matchId, version: data.expectedVersion },
        data: { version: { increment: 1 }, updatedById: actor.id },
      });
      if (!changed.count)
        throw new ApiError(409, "Snapshot pertandingan telah berubah.");
      const event = await tx.matchEvent.create({
        data: {
          organizationId,
          matchId,
          idempotencyKey: data.idempotencyKey,
          eventType: data.eventType,
          period: data.period,
          teamId: data.teamId,
          playerId: data.playerId,
          relatedPlayerId: data.relatedPlayerId,
          minute: data.minute,
          addedTime: data.addedTime,
          payload: data.payload ? json(data.payload) : undefined,
          operatorId: actor.id,
        },
      });
      const score = await recomputeScore(tx, matchId);
      await audit(
        tx,
        actor,
        organizationId,
        "CREATE",
        "MatchEvent",
        event.id,
        null,
        event,
      );
      await outbox(tx, organizationId, matchId, "match.event", {
        eventId: event.id,
        eventType: event.eventType,
        score,
      });
      return { event, score, duplicate: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function correctEvent(
  actor: Actor,
  organizationId: string,
  matchId: string,
  eventId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "match.event.correct");
  const data = eventCorrectionSchema.parse(input);
  const match = await scopedMatch(organizationId, matchId);
  if (match.status === "OFFICIAL") {
    const approved = await db.matchCorrection.findFirst({
      where: { matchId, organizationId, status: "APPROVED" },
    });
    if (!approved)
      throw new ApiError(
        409,
        "Koreksi hasil resmi harus disetujui terlebih dahulu.",
      );
  }
  const corrected = await db.$transaction(
    async (tx) => {
      const before = await tx.matchEvent.findFirst({
        where: { id: eventId, matchId, organizationId },
      });
      if (!before) throw new ApiError(404, "Event tidak ditemukan.");
      const revision = before.revision + 1;
      const after = await tx.matchEvent.update({
        where: { id: eventId },
        data: {
          eventType: data.eventType,
          period: data.period,
          teamId: data.teamId,
          playerId: data.playerId,
          relatedPlayerId: data.relatedPlayerId,
          minute: data.minute,
          addedTime: data.addedTime,
          payload: data.payload ? json(data.payload) : undefined,
          isValid: data.isValid,
          revision,
        },
      });
      await tx.matchEventRevision.create({
        data: {
          eventId,
          revision,
          actorId: actor.id,
          before: json(before),
          after: json(after),
          reason: data.reason,
        },
      });
      const score = await recomputeScore(tx, matchId);
      await tx.match.update({
        where: { id: matchId },
        data: {
          version: { increment: 1 },
          ...(match.status === "OFFICIAL"
            ? { status: "FINISHED_PENDING_APPROVAL" }
            : {}),
        },
      });
      if (match.status === "OFFICIAL")
        await tx.matchCorrection.updateMany({
          where: { matchId, organizationId, status: "APPROVED" },
          data: {
            status: "APPLIED",
            after: json({ eventId, revision, score }),
          },
        });
      await audit(
        tx,
        actor,
        organizationId,
        "UPDATE",
        "MatchEvent",
        eventId,
        before,
        after,
      );
      await outbox(tx, organizationId, matchId, "match.event.corrected", {
        eventId,
        revision,
        score,
      });
      return { event: after, score };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (match.status === "OFFICIAL")
    await reconcileDiscipline(
      actor,
      organizationId,
      match.competitionId,
      match.seasonId,
    );
  return corrected;
}

async function progressBracket(
  tx: Prisma.TransactionClient,
  matchId: string,
  winnerTeamId: string | null,
  score: ReturnType<typeof calculateScore>,
) {
  const direct = await tx.bracketTie.findFirst({
    where: { matchId },
    select: { id: true },
  });
  const leg = direct
    ? null
    : await tx.bracketLeg.findUnique({
        where: { matchId },
        include: { tie: { include: { slots: true } } },
      });
  if (!direct && !leg) return null;
  let resolvedScore = score;
  let resolvedWinnerTeamId = winnerTeamId;
  if (leg) {
    const legs = await tx.bracketLeg.findMany({
      where: { tieId: leg.tieId },
      include: {
        match: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { leg: "asc" },
    });
    const official = legs.filter((item) => item.match.status === "OFFICIAL");
    const homeClubId = leg.tie.slots.find(
      (slot) => slot.side === "HOME",
    )?.clubId;
    const awayClubId = leg.tie.slots.find(
      (slot) => slot.side === "AWAY",
    )?.clubId;
    if (!homeClubId || !awayClubId)
      throw new ApiError(409, "Slot klub untuk tie dua leg belum lengkap.");
    resolvedScore = aggregateLegScores(
      official.map((item) => ({
        homeClubId: item.match.homeTeam.clubId,
        awayClubId: item.match.awayTeam.clubId,
        homeScore: item.match.homeScore,
        awayScore: item.match.awayScore,
        shootoutHome: item.match.shootoutHome,
        shootoutAway: item.match.shootoutAway,
      })),
      homeClubId,
      awayClubId,
    );
    if (official.length < leg.tie.legs) {
      return tx.bracketTie.update({
        where: { id: leg.tieId },
        data: {
          aggregateHome: resolvedScore.home,
          aggregateAway: resolvedScore.away,
          status: "READY",
        },
      });
    }
    const winningClubId = determineWinner(
      resolvedScore,
      homeClubId,
      awayClubId,
      false,
    );
    resolvedWinnerTeamId = (
      await tx.team.findUniqueOrThrow({
        where: {
          competitionId_clubId: {
            competitionId: leg.tie.competitionId,
            clubId: winningClubId!,
          },
        },
      })
    ).id;
  }
  const tie = await tx.bracketTie.findFirst({
    where: { id: direct?.id || leg!.tieId },
    include: { nextTie: { include: { match: true } }, slots: true },
  });
  if (!tie) return null;
  if (tie.status === "COMPLETED" && tie.winnerTeamId === resolvedWinnerTeamId)
    return tie;
  if (
    tie.nextTie?.match &&
    !["DRAFT", "SCHEDULED", "LINEUP_CONFIRMED"].includes(
      tie.nextTie.match.status,
    )
  )
    throw new ApiError(
      409,
      "Bracket berikutnya sudah berlangsung dan memerlukan review manual.",
    );
  const winner = resolvedWinnerTeamId
    ? await tx.team.findUniqueOrThrow({ where: { id: resolvedWinnerTeamId } })
    : null;
  const updated = await tx.bracketTie.update({
    where: { id: tie.id },
    data: {
      aggregateHome: resolvedScore.home,
      aggregateAway: resolvedScore.away,
      penaltyHome: resolvedScore.shootoutHome,
      penaltyAway: resolvedScore.shootoutAway,
      winnerTeamId: resolvedWinnerTeamId,
      status: "COMPLETED",
    },
  });
  if (tie.nextTieId && tie.nextSide && winner) {
    const slot = await tx.bracketSlot.findUnique({
      where: { tieId_side: { tieId: tie.nextTieId, side: tie.nextSide } },
    });
    if (slot?.clubId && slot.clubId !== winner.clubId)
      throw new ApiError(
        409,
        "Slot bracket berikutnya sudah berisi klub lain.",
      );
    await tx.bracketSlot.updateMany({
      where: { tieId: tie.nextTieId, side: tie.nextSide },
      data: { clubId: winner.clubId },
    });
  }
  return updated;
}

export async function reviewMatch(
  actor: Actor,
  organizationId: string,
  matchId: string,
  input: unknown,
) {
  const data = reviewSchema.parse(input);
  await authorizeOrganization(
    actor,
    organizationId,
    data.action === "approve" ? "match.approve" : "match.review",
  );
  const match = await scopedMatch(organizationId, matchId);
  if (match.status !== "FINISHED_PENDING_APPROVAL")
    throw new ApiError(409, "Pertandingan belum menunggu approval.");
  const matchRules = await rules(match.competitionId);
  if (matchRules.separationOfDuties) {
    const operated = await db.matchEvent.findFirst({
      where: { matchId, operatorId: actor.id },
    });
    if (operated)
      throw new ApiError(
        403,
        "Operator pertandingan tidak boleh menyetujui hasil ini.",
      );
  }
  const reviewed = await db.$transaction(
    async (tx) => {
      const events = await tx.matchEvent.findMany({
        where: { matchId, isValid: true },
        orderBy: [{ minute: "asc" }, { addedTime: "asc" }],
      });
      const score = calculateScore(events, match.homeTeamId, match.awayTeamId);
      const summary = {
        score,
        refereeNotes: data.refereeNotes,
        eventCount: events.length,
      };
      const approval = await tx.matchApproval.create({
        data: {
          organizationId,
          matchId,
          approverId: actor.id,
          status: data.action === "approve" ? "APPROVED" : "REJECTED",
          notes: data.notes,
          summary: json(summary),
        },
      });
      if (data.action === "reject") {
        await audit(
          tx,
          actor,
          organizationId,
          "REJECT",
          "MatchApproval",
          approval.id,
          null,
          approval,
        );
        await outbox(tx, organizationId, matchId, "match.review.rejected", {
          approvalId: approval.id,
        });
        return { approval, match };
      }
      const winnerTeamId = determineWinner(
        score,
        match.homeTeamId,
        match.awayTeamId,
        match.stage.type !== "KNOCKOUT",
      );
      const previous = await tx.matchResult.findFirst({
        where: { matchId },
        orderBy: { version: "desc" },
      });
      await tx.matchResult.updateMany({
        where: { matchId, isCurrent: true },
        data: { isCurrent: false },
      });
      const result = await tx.matchResult.create({
        data: {
          organizationId,
          matchId,
          version: (previous?.version || 0) + 1,
          homeScore: score.home,
          awayScore: score.away,
          shootoutHome: score.shootoutHome,
          shootoutAway: score.shootoutAway,
          winnerTeamId,
          eventSnapshot: json(events),
        },
      });
      const official = await tx.match.update({
        where: { id: matchId },
        data: {
          status: "OFFICIAL",
          homeScore: score.home,
          awayScore: score.away,
          shootoutHome: score.shootoutHome,
          shootoutAway: score.shootoutAway,
          version: { increment: 1 },
          updatedById: actor.id,
        },
      });
      await progressBracket(tx, matchId, winnerTeamId, score);
      await audit(
        tx,
        actor,
        organizationId,
        "APPROVE",
        "MatchResult",
        result.id,
        previous,
        result,
      );
      await outbox(tx, organizationId, matchId, "match.official", {
        resultId: result.id,
        score,
        winnerTeamId,
      });
      return { approval, result, match: official };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  if (data.action === "approve" && "result" in reviewed && reviewed.result) {
    let statisticsRecomputeFailed = false;
    let disciplineReconcileFailed = false;
    try {
      await recomputeStatisticsFromOfficialResult(actor, {
        organizationId,
        competitionId: match.competitionId,
        seasonId: match.seasonId,
        stageId: match.stageId,
        groupId: match.groupId ?? undefined,
        idempotencyKey: `official-result:${reviewed.result.id}`,
      });
    } catch (error) {
      console.error("official-result-statistics-recompute-failed", error);
      statisticsRecomputeFailed = true;
    }
    try {
      await reconcileDiscipline(
        actor,
        organizationId,
        match.competitionId,
        match.seasonId,
      );
      await serveSuspensionsForOfficialMatch(organizationId, matchId);
    } catch (error) {
      console.error("official-result-discipline-reconcile-failed", error);
      disciplineReconcileFailed = true;
    }
    return {
      ...reviewed,
      ...(statisticsRecomputeFailed ? { statisticsRecomputeFailed: true } : {}),
      ...(disciplineReconcileFailed ? { disciplineReconcileFailed: true } : {}),
    };
  }
  return reviewed;
}

export async function requestOfficialCorrection(
  actor: Actor,
  organizationId: string,
  matchId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "match.official.correct");
  const data = correctionRequestSchema.parse(input);
  const match = await scopedMatch(organizationId, matchId);
  if (match.status !== "OFFICIAL")
    throw new ApiError(409, "Hanya hasil OFFICIAL yang dapat dikoreksi.");
  const result = await db.matchResult.findFirst({
    where: { matchId, isCurrent: true },
  });
  return db.matchCorrection.create({
    data: {
      organizationId,
      matchId,
      requesterId: actor.id,
      reason: data.reason,
      before: json({ match, result }),
    },
  });
}

export async function reviewOfficialCorrection(
  actor: Actor,
  organizationId: string,
  correctionId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "match.approve");
  const data = correctionReviewSchema.parse(input);
  const correction = await db.matchCorrection.findFirst({
    where: { id: correctionId, organizationId, status: "REQUESTED" },
  });
  if (!correction)
    throw new ApiError(404, "Permintaan koreksi tidak ditemukan.");
  if (correction.requesterId === actor.id)
    throw new ApiError(
      403,
      "Pemohon koreksi tidak boleh menyetujui permintaannya sendiri.",
    );
  return db.$transaction(async (tx) => {
    const updated = await tx.matchCorrection.update({
      where: { id: correctionId },
      data: {
        status: data.action === "approve" ? "APPROVED" : "REJECTED",
        reviewerId: actor.id,
        reviewedAt: new Date(),
        after: data.notes ? json({ notes: data.notes }) : undefined,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      data.action === "approve" ? "APPROVE" : "REJECT",
      "MatchCorrection",
      correctionId,
      correction,
      updated,
    );
    return updated;
  });
}

export async function publicMatchSnapshot(matchId: string) {
  const match = await db.match.findFirst({
    where: {
      id: matchId,
      publishedAt: { not: null },
      organization: { status: "ACTIVE", deletedAt: null },
    },
    include: snapshotInclude,
  });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  const matchRules = await rules(match.competitionId);
  return {
    id: match.id,
    status: match.status,
    kickoffAt: match.kickoffAt,
    timezone: match.timezone,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    venue: match.venue,
    score: {
      home: match.homeScore,
      away: match.awayScore,
      shootoutHome: match.shootoutHome,
      shootoutAway: match.shootoutAway,
    },
    clockState: match.clockState,
    events: match.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      period: event.period,
      minute: event.minute,
      addedTime: event.addedTime,
      occurredAt: event.occurredAt,
      team: event.team,
      player: event.player,
      relatedPlayer: event.relatedPlayer,
    })),
    lineups: matchRules.publicLineup
      ? match.lineups.map((lineup) => ({
          teamId: lineup.teamId,
          formation: lineup.formation,
          status: lineup.status,
          players: lineup.players.map((entry) => ({
            role: entry.role,
            shirtNumber: entry.shirtNumber,
            position: entry.position,
            isCaptain: entry.isCaptain,
            isGoalkeeper: entry.isGoalkeeper,
            player: entry.player,
          })),
        }))
      : [],
    officialResult: (() => {
      const result = match.results.find((entry) => entry.isCurrent);
      return result
        ? {
            version: result.version,
            homeScore: result.homeScore,
            awayScore: result.awayScore,
            shootoutHome: result.shootoutHome,
            shootoutAway: result.shootoutAway,
            winnerTeamId: result.winnerTeamId,
          }
        : null;
    })(),
  };
}

export async function realtimeMessages(
  matchId: string,
  organizationId?: string,
  after?: bigint,
) {
  const match = await db.match.findFirst({
    where: {
      id: matchId,
      ...(organizationId
        ? { organizationId }
        : {
            publishedAt: { not: null },
            organization: { status: "ACTIVE", deletedAt: null },
          }),
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      homeScore: true,
      awayScore: true,
      shootoutHome: true,
      shootoutAway: true,
      version: true,
      clockState: true,
    },
  });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  const messages =
    after === undefined
      ? []
      : await db.matchRealtimeOutbox.findMany({
          where: { matchId, sequence: { gt: after } },
          orderBy: { sequence: "asc" },
          take: 100,
        });
  return {
    snapshot: { sequence: "0", topic: "snapshot", payload: match },
    messages: messages.map((item) => ({
      sequence: item.sequence.toString(),
      topic: item.topic,
      payload: item.payload,
    })),
  };
}
