import type { MatchEventType } from "@prisma/client";

export type ScoreEvent = {
  eventType: MatchEventType;
  teamId: string | null;
  isValid: boolean;
};

export type Score = {
  home: number;
  away: number;
  shootoutHome: number;
  shootoutAway: number;
};

export function calculateScore(
  events: ScoreEvent[],
  homeTeamId: string,
  awayTeamId: string,
): Score {
  const score: Score = { home: 0, away: 0, shootoutHome: 0, shootoutAway: 0 };
  for (const event of events) {
    if (!event.isValid || !event.teamId) continue;
    const isHome = event.teamId === homeTeamId;
    const isAway = event.teamId === awayTeamId;
    if (!isHome && !isAway) continue;
    if (event.eventType === "GOAL" || event.eventType === "PENALTY_GOAL") {
      if (isHome) score.home += 1;
      else score.away += 1;
    } else if (event.eventType === "OWN_GOAL") {
      if (isHome) score.away += 1;
      else score.home += 1;
    } else if (event.eventType === "SHOOTOUT_GOAL") {
      if (isHome) score.shootoutHome += 1;
      else score.shootoutAway += 1;
    }
  }
  return score;
}

export function determineWinner(
  score: Score,
  homeTeamId: string,
  awayTeamId: string,
  allowDraw: boolean,
) {
  if (score.home !== score.away)
    return score.home > score.away ? homeTeamId : awayTeamId;
  if (score.shootoutHome !== score.shootoutAway)
    return score.shootoutHome > score.shootoutAway ? homeTeamId : awayTeamId;
  if (allowDraw) return null;
  throw new Error("Pertandingan knockout memerlukan pemenang.");
}

export function aggregateLegScores(
  legs: Array<{
    homeClubId: string;
    awayClubId: string;
    homeScore: number;
    awayScore: number;
    shootoutHome?: number;
    shootoutAway?: number;
  }>,
  tieHomeClubId: string,
  tieAwayClubId: string,
): Score {
  const aggregate: Score = {
    home: 0,
    away: 0,
    shootoutHome: 0,
    shootoutAway: 0,
  };
  for (const leg of legs) {
    if (leg.homeClubId === tieHomeClubId) {
      aggregate.home += leg.homeScore;
      aggregate.away += leg.awayScore;
      aggregate.shootoutHome = leg.shootoutHome || 0;
      aggregate.shootoutAway = leg.shootoutAway || 0;
    } else if (leg.homeClubId === tieAwayClubId) {
      aggregate.home += leg.awayScore;
      aggregate.away += leg.homeScore;
      aggregate.shootoutHome = leg.shootoutAway || 0;
      aggregate.shootoutAway = leg.shootoutHome || 0;
    } else {
      throw new Error("Leg tidak sesuai dengan peserta tie.");
    }
  }
  return aggregate;
}
