import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  ApiError,
  authorizeOrganization,
  capabilities,
  getApiActor,
} from "@/lib/auth/api";
import { db } from "@/lib/db";
import {
  buildLeaderboards,
  calculatePlayerStatistics,
  calculateStandings,
  calculateTeamStatistics,
  type OfficialMatch,
  type TieBreaker,
} from "./engine";
import {
  pointAdjustmentSchema,
  recomputeSchema,
  scopeKey,
  statisticsScopeSchema,
  type StatisticsScope,
} from "./validation";

export type Actor = Awaited<ReturnType<typeof getApiActor>>;

const snapshotInclude = {
  competition: { select: { id: true, name: true, slug: true, status: true } },
  season: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true } },
  group: { select: { id: true, name: true } },
  standings: {
    include: { club: { select: { id: true, name: true, shortName: true, logoUrl: true } } },
    orderBy: { position: "asc" as const },
  },
  teamStatistics: {
    include: { club: { select: { id: true, name: true, shortName: true, logoUrl: true } } },
    orderBy: [{ goalsFor: "desc" as const }, { clubId: "asc" as const }],
  },
  playerStatistics: {
    include: {
      player: { select: { id: true, fullName: true, displayName: true, photoUrl: true, primaryPosition: true } },
      club: { select: { id: true, name: true, shortName: true, logoUrl: true } },
    },
    orderBy: [{ goals: "desc" as const }, { assists: "desc" as const }, { playerId: "asc" as const }],
  },
  leaderboards: true,
} satisfies Prisma.StatisticsSnapshotInclude;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function validateScope(scope: StatisticsScope) {
  const season = await db.season.findFirst({
    where: {
      id: scope.seasonId,
      competitionId: scope.competitionId,
      competition: { organizationId: scope.organizationId, deletedAt: null },
    },
    include: {
      competition: { select: { id: true, name: true, status: true } },
    },
  });
  if (!season) throw new ApiError(404, "Cakupan kompetisi atau musim tidak ditemukan.");
  if (scope.stageId) {
    const stage = await db.stage.findFirst({
      where: { id: scope.stageId, seasonId: scope.seasonId, organizationId: scope.organizationId },
    });
    if (!stage) throw new ApiError(404, "Stage tidak ditemukan dalam cakupan musim.");
  }
  if (scope.groupId) {
    const group = await db.group.findFirst({
      where: {
        id: scope.groupId,
        organizationId: scope.organizationId,
        ...(scope.stageId ? { stageId: scope.stageId } : { stage: { seasonId: scope.seasonId } }),
      },
    });
    if (!group) throw new ApiError(404, "Grup tidak ditemukan dalam cakupan stage.");
  }
  return season;
}

async function authoritativeData(scope: StatisticsScope) {
  const season = await validateScope(scope);
  const matchScope = {
    organizationId: scope.organizationId,
    competitionId: scope.competitionId,
    seasonId: scope.seasonId,
    ...(scope.stageId ? { stageId: scope.stageId } : {}),
    ...(scope.groupId ? { groupId: scope.groupId } : {}),
  } satisfies Prisma.MatchWhereInput;
  const [matches, scheduledCount, unfinishedCount, stage] = await Promise.all([
  db.match.findMany({
    where: {
      ...matchScope,
      status: "OFFICIAL",
    },
    include: {
      homeTeam: { select: { clubId: true } },
      awayTeam: { select: { clubId: true } },
      results: { where: { isCurrent: true }, take: 1 },
      events: {
        where: { isValid: true },
        select: {
          id: true,
          eventType: true,
          playerId: true,
          relatedPlayerId: true,
          minute: true,
          isValid: true,
          team: { select: { clubId: true } },
        },
      },
      lineups: {
        include: {
          team: { select: { clubId: true } },
          players: { select: { playerId: true, role: true, isGoalkeeper: true } },
        },
      },
    },
    orderBy: [{ kickoffAt: "asc" }, { id: "asc" }],
  }),
  db.match.count({ where: { ...matchScope, status: { notIn: ["DRAFT", "CANCELLED"] } } }),
  db.match.count({ where: { ...matchScope, status: { notIn: ["OFFICIAL", "CANCELLED"] } } }),
  scope.stageId ? db.stage.findUnique({ where: { id: scope.stageId }, select: { settings: true } }) : Promise.resolve(null),
  ]);
  const officialMatches: OfficialMatch[] = matches.flatMap((match) => {
    const result = match.results[0];
    if (!result) return [];
    return [{
      id: match.id,
      status: match.status,
      homeClubId: match.homeTeam.clubId,
      awayClubId: match.awayTeam.clubId,
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      kickoffAt: match.kickoffAt,
      events: match.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        teamClubId: event.team?.clubId,
        playerId: event.playerId,
        relatedPlayerId: event.relatedPlayerId,
        minute: event.minute,
        isValid: event.isValid,
      })),
      lineups: match.lineups.map((lineup) => ({
        clubId: lineup.team.clubId,
        status: lineup.status,
        players: lineup.players,
      })),
    }];
  });
  const clubIds = scope.groupId
    ? (await db.groupMembership.findMany({
        where: { organizationId: scope.organizationId, groupId: scope.groupId },
        select: { clubId: true },
        orderBy: [{ seed: "asc" }, { clubId: "asc" }],
      })).map((entry) => entry.clubId)
    : (await db.competitionClub.findMany({
        where: { organizationId: scope.organizationId, seasonId: scope.seasonId, status: "APPROVED" },
        select: { clubId: true },
        orderBy: { clubId: "asc" },
      })).map((entry) => entry.clubId);
  const adjustments = await db.pointAdjustment.findMany({
    where: {
      organizationId: scope.organizationId,
      competitionId: scope.competitionId,
      seasonId: scope.seasonId,
      OR: [{ stageId: null }, ...(scope.stageId ? [{ stageId: scope.stageId }] : [])],
      AND: [
        { OR: [{ groupId: null }, ...(scope.groupId ? [{ groupId: scope.groupId }] : [])] },
      ],
    },
    orderBy: [{ effectiveAt: "asc" }, { id: "asc" }],
  });
  const adjustmentMap = Object.fromEntries(
    clubIds.map((clubId) => [
      clubId,
      adjustments.filter((item) => item.clubId === clubId).reduce((sum, item) => sum + item.amount, 0),
    ]),
  );
  const fairPlay = Object.fromEntries(clubIds.map((clubId) => [clubId, 0]));
  for (const match of officialMatches) {
    for (const event of match.events ?? []) {
      if (!event.teamClubId) continue;
      if (event.eventType === "YELLOW_CARD") fairPlay[event.teamClubId] = (fairPlay[event.teamClubId] ?? 0) + 1;
      if (event.eventType === "SECOND_YELLOW_CARD") fairPlay[event.teamClubId] = (fairPlay[event.teamClubId] ?? 0) + 3;
      if (event.eventType === "RED_CARD") fairPlay[event.teamClubId] = (fairPlay[event.teamClubId] ?? 0) + 3;
    }
  }
  const stageSettings = (stage?.settings ?? {}) as Record<string, unknown>;
  const fingerprintSource = matches.map((match) => ({
    id: match.id,
    result: match.results[0] ? { id: match.results[0].id, version: match.results[0].version, homeScore: match.results[0].homeScore, awayScore: match.results[0].awayScore } : null,
    events: match.events.map((event) => ({ id: event.id, type: event.eventType, playerId: event.playerId, relatedPlayerId: event.relatedPlayerId, minute: event.minute })),
    lineups: match.lineups.map((lineup) => ({ id: lineup.id, version: lineup.version, status: lineup.status })),
  }));
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ fingerprintSource, adjustments: adjustments.map(({ id, clubId, amount, effectiveAt }) => ({ id, clubId, amount, effectiveAt })) }))
    .digest("hex");
  return {
    season,
    matches: officialMatches,
    clubIds,
    adjustments: adjustmentMap,
    fairPlay,
    competitionComplete: scheduledCount > 0 && unfinishedCount === 0,
    qualifiedPositions: Number(stageSettings.qualifiersPerGroup) > 0 ? Number(stageSettings.qualifiersPerGroup) : undefined,
    fingerprint,
    sourceResultVersion: Math.max(0, ...matches.flatMap((match) => match.results.map((result) => result.version))),
  };
}

function normalizedTieBreakers(value: Prisma.JsonValue): TieBreaker[] {
  const allowed = new Set<TieBreaker>([
    "points", "goal_difference", "goals_for", "head_to_head_points",
    "head_to_head_goal_difference", "head_to_head_goals_for", "fair_play", "manual",
  ]);
  return Array.isArray(value)
    ? value.filter((item): item is TieBreaker => typeof item === "string" && allowed.has(item as TieBreaker))
    : [];
}

async function performRecompute(
  actor: Actor,
  input: unknown,
  enforceAuthorization: boolean,
) {
  const parsed = recomputeSchema.parse(input);
  if (enforceAuthorization)
    await authorizeOrganization(actor, parsed.organizationId, "statistics.recompute");
  const scope = statisticsScopeSchema.parse(parsed);
  const key = scopeKey(scope);
  const existing = await db.statisticsRecomputeJob.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: scope.organizationId, idempotencyKey: parsed.idempotencyKey } },
  });
  if (existing?.status === "COMPLETED") {
    const current = await getStatistics(actor, scope);
    if (!current.snapshot) throw new ApiError(409, "Snapshot hasil job tidak ditemukan.");
    return { ...current.snapshot, stale: current.stale };
  }
  const job = existing ?? await db.statisticsRecomputeJob.create({
    data: {
      organizationId: scope.organizationId,
      competitionId: scope.competitionId,
      seasonId: scope.seasonId,
      scopeKey: key,
      idempotencyKey: parsed.idempotencyKey,
      status: "PENDING",
      trigger: "MANUAL",
    },
  });
  await db.statisticsRecomputeJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), errorMessage: null },
  });
  try {
    const source = await authoritativeData(scope);
    const tieBreakers = normalizedTieBreakers(source.season.tieBreakers);
    const standings = calculateStandings(source.clubIds, source.matches, {
      winPoints: source.season.winPoints,
      drawPoints: source.season.drawPoints,
      lossPoints: source.season.lossPoints,
      tieBreakers,
      adjustments: source.adjustments,
      fairPlay: source.fairPlay,
      competitionComplete: source.competitionComplete,
      qualifiedPositions: source.qualifiedPositions,
    });
    const teams = calculateTeamStatistics(source.clubIds, source.matches);
    const players = calculatePlayerStatistics(source.matches);
    const leaderboards = buildLeaderboards(players, teams);
    const snapshot = await db.$transaction(async (tx) => {
      const latest = await tx.statisticsSnapshot.findFirst({
        where: { organizationId: scope.organizationId, scopeKey: key },
        orderBy: { version: "desc" },
        select: { version: true, id: true, sourceFingerprint: true },
      });
      if (latest?.sourceFingerprint === source.fingerprint) {
        await tx.statisticsRecomputeJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return tx.statisticsSnapshot.findUniqueOrThrow({ where: { id: latest.id }, include: snapshotInclude });
      }
      const created = await tx.statisticsSnapshot.create({
        data: {
          organizationId: scope.organizationId,
          competitionId: scope.competitionId,
          seasonId: scope.seasonId,
          stageId: scope.stageId,
          groupId: scope.groupId,
          scopeKey: key,
          version: (latest?.version ?? 0) + 1,
          sourceFingerprint: source.fingerprint,
          sourceResultVersion: source.sourceResultVersion,
          status: "PUBLISHED",
          computedById: actor.id,
          publishedAt: new Date(),
          standings: { create: standings.map((row) => ({ ...row, form: json(row.form) })) },
          teamStatistics: {
            create: teams.map((row) => ({
              clubId: row.clubId, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
              goalsFor: row.goalsFor, goalsAgainst: row.goalsAgainst, goalDifference: row.goalDifference,
              cleanSheets: row.cleanSheets, homePlayed: row.home.played, homeWon: row.home.won,
              homeDrawn: row.home.drawn, homeLost: row.home.lost, awayPlayed: row.away.played,
              awayWon: row.away.won, awayDrawn: row.away.drawn, awayLost: row.away.lost,
              longestWinStreak: row.longestWinStreak, longestUnbeatenStreak: row.longestUnbeatenStreak,
              currentForm: json(row.currentForm),
            })),
          },
          playerStatistics: { create: players },
          leaderboards: {
            create: Object.entries(leaderboards).map(([metric, entries]) => ({
              metric,
              entries: json(entries),
              tieBreakers: json(metric.includes("club") ? ["metric", "club_id"] : ["metric", "appearances", "player_id"]),
            })),
          },
        },
        include: snapshotInclude,
      });
      await tx.statisticsRevision.create({
        data: {
          organizationId: scope.organizationId,
          snapshotId: created.id,
          actorId: actor.id,
          action: latest ? "RECOMPUTE" : "INITIAL_BUILD",
          before: latest ? json({ snapshotId: latest.id, version: latest.version }) : Prisma.JsonNull,
          after: json({ snapshotId: created.id, version: created.version, fingerprint: created.sourceFingerprint }),
        },
      });
      await tx.statisticsRecomputeJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: actor.id,
          action: "UPDATE",
          resourceType: "StatisticsSnapshot",
          resourceId: created.id,
          after: json({ scopeKey: key, version: created.version }),
        },
      });
      return created;
    });
    return { ...snapshot, stale: false };
  } catch (error) {
    await db.statisticsRecomputeJob.update({
      where: { id: job.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: error instanceof Error ? error.message : "Recompute gagal" },
    });
    throw error;
  }
}

export function recomputeStatistics(actor: Actor, input: unknown) {
  return performRecompute(actor, input, true);
}

/** Trusted integration hook used only after Phase 4 commits an OFFICIAL result. */
export function recomputeStatisticsFromOfficialResult(actor: Actor, input: unknown) {
  return performRecompute(actor, input, false);
}

export async function getStatistics(actor: Actor, input: unknown) {
  const scope = statisticsScopeSchema.parse(input);
  await authorizeOrganization(actor, scope.organizationId, "statistics.view");
  await validateScope(scope);
  const snapshot = await db.statisticsSnapshot.findFirst({
    where: { organizationId: scope.organizationId, scopeKey: scopeKey(scope), status: "PUBLISHED" },
    include: snapshotInclude,
    orderBy: { version: "desc" },
  });
  const source = await authoritativeData(scope);
  const caps = await capabilities(actor, scope.organizationId, [
    "standings.view", "standings.recompute", "standings.adjust",
    "statistics.view", "statistics.recompute", "statistics.export", "leaderboard.view",
  ]);
  return { snapshot, stale: !snapshot || snapshot.sourceFingerprint !== source.fingerprint, capabilities: caps };
}

export async function statisticsLookups(actor: Actor, organizationId: string) {
  await authorizeOrganization(actor, organizationId, "statistics.view");
  const [competitions, seasons, stages, groups, clubs] = await Promise.all([
    db.competition.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, name: true, status: true },
      orderBy: { name: "asc" },
    }),
    db.season.findMany({
      where: { competition: { organizationId, deletedAt: null } },
      select: { id: true, name: true, competitionId: true, status: true },
      orderBy: { startsAt: "desc" },
    }),
    db.stage.findMany({
      where: { organizationId },
      select: { id: true, name: true, seasonId: true, type: true },
      orderBy: [{ seasonId: "asc" }, { sortOrder: "asc" }],
    }),
    db.group.findMany({
      where: { organizationId },
      select: { id: true, name: true, stageId: true },
      orderBy: [{ stageId: "asc" }, { name: "asc" }],
    }),
    db.club.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { competitions, seasons, stages, groups, clubs };
}

export async function getStatisticsForExport(actor: Actor, input: unknown) {
  const scope = statisticsScopeSchema.parse(input);
  await authorizeOrganization(actor, scope.organizationId, "statistics.export");
  return getStatistics(actor, scope);
}

export async function createPointAdjustment(actor: Actor, input: unknown) {
  const data = pointAdjustmentSchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "standings.adjust");
  await validateScope(data);
  const club = await db.competitionClub.findFirst({
    where: { organizationId: data.organizationId, seasonId: data.seasonId, clubId: data.clubId },
  });
  if (!club) throw new ApiError(404, "Klub tidak terdaftar pada musim ini.");
  return db.$transaction(async (tx) => {
    const adjustment = await tx.pointAdjustment.create({ data: { ...data, approvedById: actor.id } });
    await tx.auditLog.create({
      data: {
        organizationId: data.organizationId,
        actorId: actor.id,
        action: "APPROVE",
        resourceType: "PointAdjustment",
        resourceId: adjustment.id,
        after: json(adjustment),
      },
    });
    return adjustment;
  });
}

export async function listPointAdjustments(actor: Actor, input: unknown) {
  const scope = statisticsScopeSchema.parse(input);
  await authorizeOrganization(actor, scope.organizationId, "standings.view");
  await validateScope(scope);
  return db.pointAdjustment.findMany({
    where: {
      organizationId: scope.organizationId,
      competitionId: scope.competitionId,
      seasonId: scope.seasonId,
      ...(scope.stageId ? { stageId: scope.stageId } : {}),
      ...(scope.groupId ? { groupId: scope.groupId } : {}),
    },
    include: {
      club: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function publicStatistics(input: unknown) {
  const scope = statisticsScopeSchema.parse(input);
  const snapshot = await db.statisticsSnapshot.findFirst({
    where: {
      organizationId: scope.organizationId,
      scopeKey: scopeKey(scope),
      status: "PUBLISHED",
      competition: { status: { in: ["ONGOING", "COMPLETED"] }, deletedAt: null },
    },
    include: snapshotInclude,
    orderBy: { version: "desc" },
  });
  if (!snapshot) throw new ApiError(404, "Statistik publik belum tersedia.");
  return snapshot;
}
