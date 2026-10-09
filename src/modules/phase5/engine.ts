export type TieBreaker =
  | "points"
  | "goal_difference"
  | "goals_for"
  | "head_to_head_points"
  | "head_to_head_goal_difference"
  | "head_to_head_goals_for"
  | "fair_play"
  | "manual";

export type OfficialMatch = {
  id: string;
  status: string;
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  kickoffAt?: Date | string | null;
  events?: MatchStatEvent[];
  lineups?: MatchStatLineup[];
};

export type MatchStatEvent = {
  id: string;
  eventType: string;
  teamClubId?: string | null;
  playerId?: string | null;
  relatedPlayerId?: string | null;
  minute?: number;
  isValid: boolean;
};

export type MatchStatLineup = {
  clubId: string;
  status: string;
  players: Array<{
    playerId: string;
    role: "STARTER" | "SUBSTITUTE";
    isGoalkeeper?: boolean;
  }>;
};

export type Standing = {
  clubId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  rawPoints: number;
  adjustmentPoints: number;
  points: number;
  fairPlayPoints: number;
  form: string[];
  resolutionStatus: "RESOLVED" | "UNRESOLVED" | "MANUAL";
  qualificationStatus: "UNDECIDED" | "QUALIFIED" | "ELIMINATED";
};

export type StandingsOptions = {
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  tieBreakers?: TieBreaker[];
  adjustments?: Record<string, number>;
  fairPlay?: Record<string, number>;
  manualOrder?: string[];
  qualifiedPositions?: number;
  competitionComplete?: boolean;
};

const DEFAULT_TIE_BREAKERS: TieBreaker[] = [
  "points",
  "goal_difference",
  "goals_for",
  "head_to_head_points",
  "head_to_head_goal_difference",
  "head_to_head_goals_for",
  "fair_play",
  "manual",
];

function emptyStanding(clubId: string): Standing {
  return {
    clubId,
    position: 0,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    rawPoints: 0,
    adjustmentPoints: 0,
    points: 0,
    fairPlayPoints: 0,
    form: [],
    resolutionStatus: "RESOLVED",
    qualificationStatus: "UNDECIDED",
  };
}

function official(matches: OfficialMatch[]) {
  return matches.filter((match) => match.status === "OFFICIAL");
}

function miniLeague(
  matches: OfficialMatch[],
  clubIds: Set<string>,
  winPoints: number,
  drawPoints: number,
  lossPoints: number,
) {
  const mini = new Map<string, { points: number; gd: number; gf: number }>();
  for (const clubId of clubIds) mini.set(clubId, { points: 0, gd: 0, gf: 0 });
  for (const match of official(matches)) {
    if (!clubIds.has(match.homeClubId) || !clubIds.has(match.awayClubId)) continue;
    const home = mini.get(match.homeClubId)!;
    const away = mini.get(match.awayClubId)!;
    home.gf += match.homeScore;
    home.gd += match.homeScore - match.awayScore;
    away.gf += match.awayScore;
    away.gd += match.awayScore - match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.points += winPoints;
      away.points += lossPoints;
    } else if (match.awayScore > match.homeScore) {
      away.points += winPoints;
      home.points += lossPoints;
    }
    else {
      home.points += drawPoints;
      away.points += drawPoints;
    }
  }
  return mini;
}

export function calculateStandings(
  clubIds: string[],
  matches: OfficialMatch[],
  options: StandingsOptions = {},
) {
  const winPoints = options.winPoints ?? 3;
  const drawPoints = options.drawPoints ?? 1;
  const lossPoints = options.lossPoints ?? 0;
  const rows = new Map(clubIds.map((id) => [id, emptyStanding(id)]));
  const sortedMatches = official(matches).toSorted((a, b) =>
    `${a.kickoffAt ?? ""}:${a.id}`.localeCompare(`${b.kickoffAt ?? ""}:${b.id}`),
  );

  for (const match of sortedMatches) {
    const home = rows.get(match.homeClubId);
    const away = rows.get(match.awayClubId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won += 1;
      away.lost += 1;
      home.rawPoints += winPoints;
      away.rawPoints += lossPoints;
      home.form.push("W");
      away.form.push("L");
    } else if (match.awayScore > match.homeScore) {
      away.won += 1;
      home.lost += 1;
      away.rawPoints += winPoints;
      home.rawPoints += lossPoints;
      away.form.push("W");
      home.form.push("L");
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.rawPoints += drawPoints;
      away.rawPoints += drawPoints;
      home.form.push("D");
      away.form.push("D");
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    row.adjustmentPoints = options.adjustments?.[row.clubId] ?? 0;
    row.points = row.rawPoints + row.adjustmentPoints;
    row.fairPlayPoints = options.fairPlay?.[row.clubId] ?? 0;
    row.form = row.form.slice(-5);
  }

  const criteria = options.tieBreakers?.length
    ? options.tieBreakers
    : DEFAULT_TIE_BREAKERS;
  const allRows = [...rows.values()];
  const manual = new Map((options.manualOrder ?? []).map((id, index) => [id, index]));
  const value = (
    row: Standing,
    criterion: TieBreaker,
    mini: ReturnType<typeof miniLeague>,
  ) => {
    if (criterion === "points") return row.points;
    if (criterion === "goal_difference") return row.goalDifference;
    if (criterion === "goals_for") return row.goalsFor;
    if (criterion === "head_to_head_points") return mini.get(row.clubId)?.points ?? 0;
    if (criterion === "head_to_head_goal_difference") return mini.get(row.clubId)?.gd ?? 0;
    if (criterion === "head_to_head_goals_for") return mini.get(row.clubId)?.gf ?? 0;
    if (criterion === "fair_play") return -row.fairPlayPoints;
    return manual.has(row.clubId) ? -(manual.get(row.clubId) ?? 0) : Number.MIN_SAFE_INTEGER;
  };
  const unresolved = new Set<string>();
  const manuallyResolved = new Set<string>();
  const sortGroup = (group: Standing[], criterionIndex: number): Standing[] => {
    if (group.length <= 1) return group;
    if (criterionIndex >= criteria.length) {
      group.forEach((row) => unresolved.add(row.clubId));
      return group.toSorted((a, b) => a.clubId.localeCompare(b.clubId));
    }
    const criterion = criteria[criterionIndex];
    const mini = miniLeague(
      sortedMatches,
      new Set(group.map((row) => row.clubId)),
      winPoints,
      drawPoints,
      lossPoints,
    );
    const buckets = new Map<number, Standing[]>();
    for (const row of group) {
      const score = value(row, criterion, mini);
      buckets.set(score, [...(buckets.get(score) ?? []), row]);
    }
    const ordered = [...buckets.entries()].sort(([a], [b]) => b - a);
    if (criterion === "manual" && ordered.length > 1) {
      group.forEach((row) => manuallyResolved.add(row.clubId));
    }
    return ordered.flatMap(([, bucket]) => sortGroup(bucket, criterionIndex + 1));
  };
  const orderedRows = sortGroup(allRows, 0);

  orderedRows.forEach((row, index) => {
    row.position = index + 1;
    row.resolutionStatus = unresolved.has(row.clubId)
      ? "UNRESOLVED"
      : manuallyResolved.has(row.clubId)
        ? "MANUAL"
        : "RESOLVED";
    if (options.competitionComplete && options.qualifiedPositions != null) {
      row.qualificationStatus =
        row.position <= options.qualifiedPositions ? "QUALIFIED" : "ELIMINATED";
    }
  });
  return orderedRows;
}

export function calculateTeamStatistics(clubIds: string[], matches: OfficialMatch[]) {
  const standings = calculateStandings(clubIds, matches);
  return standings.map((row) => {
    const clubMatches = official(matches)
      .filter((match) => match.homeClubId === row.clubId || match.awayClubId === row.clubId)
      .toSorted((a, b) => `${a.kickoffAt ?? ""}:${a.id}`.localeCompare(`${b.kickoffAt ?? ""}:${b.id}`));
    let longestWinStreak = 0;
    let longestUnbeatenStreak = 0;
    let winStreak = 0;
    let unbeatenStreak = 0;
    let cleanSheets = 0;
    const record = { home: { played: 0, won: 0, drawn: 0, lost: 0 }, away: { played: 0, won: 0, drawn: 0, lost: 0 } };
    for (const match of clubMatches) {
      const isHome = match.homeClubId === row.clubId;
      const goalsFor = isHome ? match.homeScore : match.awayScore;
      const goalsAgainst = isHome ? match.awayScore : match.homeScore;
      const side = isHome ? record.home : record.away;
      side.played += 1;
      if (goalsAgainst === 0) cleanSheets += 1;
      if (goalsFor > goalsAgainst) {
        side.won += 1;
        winStreak += 1;
        unbeatenStreak += 1;
      } else if (goalsFor === goalsAgainst) {
        side.drawn += 1;
        winStreak = 0;
        unbeatenStreak += 1;
      } else {
        side.lost += 1;
        winStreak = 0;
        unbeatenStreak = 0;
      }
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      longestUnbeatenStreak = Math.max(longestUnbeatenStreak, unbeatenStreak);
    }
    return {
      clubId: row.clubId,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      goalDifference: row.goalDifference,
      cleanSheets,
      winRate: row.played ? row.won / row.played : 0,
      goalsPerMatch: row.played ? row.goalsFor / row.played : 0,
      home: record.home,
      away: record.away,
      currentForm: row.form,
      longestWinStreak,
      longestUnbeatenStreak,
    };
  });
}

export type PlayerStatistics = {
  playerId: string;
  clubId: string;
  appearances: number;
  starts: number;
  minutesPlayed: number | null;
  goals: number;
  assists: number;
  ownGoals: number;
  penaltyGoals: number;
  penaltyMisses: number;
  yellowCards: number;
  secondYellowCards: number;
  redCards: number;
  cleanSheets: number | null;
};

export function calculatePlayerStatistics(matches: OfficialMatch[]) {
  const rows = new Map<string, PlayerStatistics>();
  const get = (playerId: string, clubId: string) => {
    const key = `${playerId}:${clubId}`;
    if (!rows.has(key)) rows.set(key, { playerId, clubId, appearances: 0, starts: 0, minutesPlayed: null, goals: 0, assists: 0, ownGoals: 0, penaltyGoals: 0, penaltyMisses: 0, yellowCards: 0, secondYellowCards: 0, redCards: 0, cleanSheets: null });
    return rows.get(key)!;
  };
  for (const match of official(matches)) {
    const events = (match.events ?? []).filter((event) => event.isValid);
    for (const lineup of (match.lineups ?? []).filter((item) => item.status === "CONFIRMED")) {
      const entrants = new Set(
        events
          .filter((event) => event.eventType === "SUBSTITUTION" && event.teamClubId === lineup.clubId)
          .map((event) => event.relatedPlayerId)
          .filter(Boolean) as string[],
      );
      for (const player of lineup.players) {
        if (player.role !== "STARTER" && !entrants.has(player.playerId)) continue;
        const row = get(player.playerId, lineup.clubId);
        row.appearances += 1;
        if (player.role === "STARTER") row.starts += 1;
        if (player.isGoalkeeper) {
          row.cleanSheets ??= 0;
          const conceded = lineup.clubId === match.homeClubId ? match.awayScore : match.homeScore;
          if (conceded === 0) row.cleanSheets += 1;
        }
      }
    }
    for (const event of events) {
      if (!event.playerId || !event.teamClubId) continue;
      const row = get(event.playerId, event.teamClubId);
      if (event.eventType === "GOAL") row.goals += 1;
      if (event.eventType === "PENALTY_GOAL") { row.goals += 1; row.penaltyGoals += 1; }
      if (event.eventType === "ASSIST") row.assists += 1;
      if (event.eventType === "OWN_GOAL") row.ownGoals += 1;
      if (event.eventType === "PENALTY_MISSED") row.penaltyMisses += 1;
      if (event.eventType === "YELLOW_CARD") row.yellowCards += 1;
      if (event.eventType === "SECOND_YELLOW_CARD") row.secondYellowCards += 1;
      if (event.eventType === "RED_CARD") row.redCards += 1;
    }
  }
  return [...rows.values()].sort((a, b) => a.playerId.localeCompare(b.playerId) || a.clubId.localeCompare(b.clubId));
}

export function buildLeaderboards(
  players: PlayerStatistics[],
  teams: ReturnType<typeof calculateTeamStatistics>,
) {
  const playerBoard = (metric: keyof PlayerStatistics) =>
    players
      .filter((row) => typeof row[metric] === "number")
      .toSorted((a, b) => Number(b[metric] ?? 0) - Number(a[metric] ?? 0) || b.appearances - a.appearances || a.playerId.localeCompare(b.playerId))
      .map((row) => ({ playerId: row.playerId, clubId: row.clubId, value: Number(row[metric] ?? 0) }));
  const teamBoard = (metric: "goalsFor" | "goalsAgainst", ascending = false) =>
    teams.toSorted((a, b) => (ascending ? a[metric] - b[metric] : b[metric] - a[metric]) || a.clubId.localeCompare(b.clubId)).map((row) => ({ clubId: row.clubId, value: row[metric] }));
  return {
    top_scorer: playerBoard("goals"),
    top_assist: playerBoard("assists"),
    most_appearances: playerBoard("appearances"),
    most_clean_sheets: playerBoard("cleanSheets"),
    most_yellow_cards: playerBoard("yellowCards"),
    most_red_cards: playerBoard("redCards"),
    best_attacking_club: teamBoard("goalsFor"),
    best_defensive_club: teamBoard("goalsAgainst", true),
  };
}
