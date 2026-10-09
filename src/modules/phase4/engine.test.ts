import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "./lifecycle";
import { validateLineup } from "./lineup";
import { reconnectMessages } from "./realtime";
import { aggregateLegScores, calculateScore, determineWinner } from "./score";

describe("Phase 4 match engines", () => {
  it("calculates goals, own goals, shootout and invalid corrections", () => {
    const score = calculateScore(
      [
        { eventType: "GOAL", teamId: "home", isValid: true },
        { eventType: "GOAL", teamId: "home", isValid: false },
        { eventType: "OWN_GOAL", teamId: "home", isValid: true },
        { eventType: "PENALTY_GOAL", teamId: "away", isValid: true },
        { eventType: "PENALTY_MISSED", teamId: "away", isValid: true },
        { eventType: "SHOOTOUT_GOAL", teamId: "home", isValid: true },
      ],
      "home",
      "away",
    );
    expect(score).toEqual({
      home: 1,
      away: 2,
      shootoutHome: 1,
      shootoutAway: 0,
    });
  });

  it("validates lifecycle and knockout draws", () => {
    expect(canTransition("SCHEDULED", "LINEUP_CONFIRMED")).toBe(true);
    expect(() => assertTransition("SCHEDULED", "OFFICIAL")).toThrow();
    expect(() =>
      determineWinner(
        { home: 1, away: 1, shootoutHome: 0, shootoutAway: 0 },
        "home",
        "away",
        false,
      ),
    ).toThrow();
  });

  it("aggregates a two-leg tie regardless of home and away reversal", () => {
    expect(
      aggregateLegScores(
        [
          { homeClubId: "a", awayClubId: "b", homeScore: 2, awayScore: 1 },
          { homeClubId: "b", awayClubId: "a", homeScore: 1, awayScore: 1 },
        ],
        "a",
        "b",
      ),
    ).toEqual({ home: 3, away: 2, shootoutHome: 0, shootoutAway: 0 });
  });

  it("rejects ineligible and cross-team lineup players", () => {
    const errors = validateLineup(
      [
        {
          playerId: "p1",
          teamId: "away",
          role: "STARTER",
          shirtNumber: 1,
          isCaptain: true,
          isGoalkeeper: true,
          eligible: false,
        },
      ],
      "home",
      1,
      5,
    );
    expect(errors).toContain("Terdapat pemain yang tidak eligible.");
    expect(errors).toContain("Pemain berasal dari tim yang berbeda.");
  });

  it("reconnects from missed ordered messages or a snapshot", () => {
    const snapshot = {
      sequence: BigInt(5),
      topic: "snapshot",
      payload: { score: "1-0" },
    };
    const messages = [
      { sequence: BigInt(7), topic: "event", payload: { id: 2 } },
      { sequence: BigInt(6), topic: "event", payload: { id: 1 } },
    ];
    expect(
      reconnectMessages(snapshot, messages, BigInt(5)).map(
        (item) => item.sequence,
      ),
    ).toEqual([BigInt(6), BigInt(7)]);
    expect(reconnectMessages(snapshot, messages, BigInt(7))).toEqual([
      snapshot,
    ]);
  });
});
