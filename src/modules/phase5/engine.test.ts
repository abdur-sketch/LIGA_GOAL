import { describe, expect, it } from "vitest";
import {
  buildLeaderboards,
  calculatePlayerStatistics,
  calculateStandings,
  calculateTeamStatistics,
  type OfficialMatch,
} from "./engine";

const match = (
  id: string,
  homeClubId: string,
  awayClubId: string,
  homeScore: number,
  awayScore: number,
  status = "OFFICIAL",
): OfficialMatch => ({ id, homeClubId, awayClubId, homeScore, awayScore, status });

describe("Phase 5 statistics engine", () => {
  it("uses default and custom points, goal difference and excludes non-official matches", () => {
    const games = [
      match("1", "a", "b", 2, 0),
      match("2", "a", "c", 1, 1),
      match("3", "b", "c", 9, 0, "LIVE_SECOND_HALF"),
      match("4", "b", "c", 0, 2, "FINISHED_PENDING_APPROVAL"),
    ];
    const table = calculateStandings(["a", "b", "c"], games);
    expect(table.find((row) => row.clubId === "a")).toMatchObject({
      points: 4,
      goalDifference: 2,
      played: 2,
    });
    expect(table.find((row) => row.clubId === "b")?.played).toBe(1);
    expect(
      calculateStandings(["a", "b", "c"], games, {
        winPoints: 5,
        drawPoints: 2,
        lossPoints: 1,
      }).find((row) => row.clubId === "a")?.points,
    ).toBe(7);
  });

  it("resolves two-club head-to-head after equal points and goal difference", () => {
    const table = calculateStandings(
      ["a", "b", "c", "d"],
      [
        match("1", "a", "b", 1, 0),
        match("2", "a", "c", 0, 2),
        match("3", "b", "d", 2, 0),
      ],
      { tieBreakers: ["points", "head_to_head_points"] },
    );
    expect(table.map((row) => row.clubId).indexOf("a")).toBeLessThan(
      table.map((row) => row.clubId).indexOf("b"),
    );
  });

  it("uses a three-club mini-league and reports unresolved ties deterministically", () => {
    const table = calculateStandings(
      ["a", "b", "c"],
      [
        match("1", "a", "b", 1, 0),
        match("2", "b", "c", 2, 0),
        match("3", "c", "a", 4, 0),
      ],
      { tieBreakers: ["points", "head_to_head_goal_difference"] },
    );
    expect(table.map((row) => row.clubId)).toEqual(["c", "b", "a"]);
    const unresolved = calculateStandings(["b", "a"], [], {
      tieBreakers: ["points", "goal_difference"],
    });
    expect(unresolved.map((row) => row.clubId)).toEqual(["a", "b"]);
    expect(unresolved.every((row) => row.resolutionStatus === "UNRESOLVED")).toBe(true);
  });

  it("applies point deductions without changing scores and keeps groups isolated", () => {
    const groupA = calculateStandings(["a", "b"], [match("1", "a", "b", 2, 0)], {
      adjustments: { a: -4 },
    });
    const groupB = calculateStandings(["c", "d"], [match("2", "c", "d", 0, 0)]);
    expect(groupA.find((row) => row.clubId === "a")).toMatchObject({
      goalsFor: 2,
      rawPoints: 3,
      adjustmentPoints: -4,
      points: -1,
    });
    expect(groupB.every((row) => ["c", "d"].includes(row.clubId))).toBe(true);
  });

  it("keeps qualification undecided until completion and supports fair-play tie-break", () => {
    const undecided = calculateStandings(["a", "b"], [], {
      qualifiedPositions: 1,
      competitionComplete: false,
    });
    expect(undecided.every((row) => row.qualificationStatus === "UNDECIDED")).toBe(true);
    const completed = calculateStandings(["a", "b"], [match("1", "a", "b", 0, 0)], {
      tieBreakers: ["points", "fair_play"],
      fairPlay: { a: 1, b: 3 },
      qualifiedPositions: 1,
      competitionComplete: true,
    });
    expect(completed.map((row) => row.clubId)).toEqual(["a", "b"]);
    expect(completed.map((row) => row.qualificationStatus)).toEqual(["QUALIFIED", "ELIMINATED"]);
  });

  it("calculates team streaks, home/away records and clean sheets", () => {
    const stats = calculateTeamStatistics(
      ["a", "b", "c"],
      [match("1", "a", "b", 2, 0), match("2", "c", "a", 0, 1)],
    ).find((row) => row.clubId === "a");
    expect(stats).toMatchObject({
      played: 2,
      cleanSheets: 2,
      longestWinStreak: 2,
      longestUnbeatenStreak: 2,
      home: { played: 1, won: 1 },
      away: { played: 1, won: 1 },
    });
  });

  it("uses confirmed historical lineups and only valid events for player leaderboards", () => {
    const games: OfficialMatch[] = [
      {
        ...match("1", "old-club", "opponent", 2, 0),
        lineups: [
          {
            clubId: "old-club",
            status: "CONFIRMED",
            players: [{ playerId: "p1", role: "STARTER", isGoalkeeper: false }],
          },
        ],
        events: [
          { id: "e1", eventType: "GOAL", teamClubId: "old-club", playerId: "p1", isValid: true },
          { id: "e2", eventType: "GOAL", teamClubId: "old-club", playerId: "p1", isValid: false },
          { id: "e3", eventType: "ASSIST", teamClubId: "old-club", playerId: "p1", isValid: true },
        ],
      },
    ];
    const players = calculatePlayerStatistics(games);
    expect(players[0]).toMatchObject({
      playerId: "p1",
      clubId: "old-club",
      appearances: 1,
      starts: 1,
      minutesPlayed: null,
      goals: 1,
      assists: 1,
    });
    const boards = buildLeaderboards(players, calculateTeamStatistics(["old-club", "opponent"], games));
    expect(boards.top_scorer[0]).toMatchObject({ playerId: "p1", value: 1 });
    expect(boards.top_assist[0]).toMatchObject({ playerId: "p1", value: 1 });
  });
});
