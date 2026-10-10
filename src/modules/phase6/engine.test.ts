import { describe, expect, it } from "vitest";
import {
  automaticSuspensionSpecs,
  availabilityAt,
  nextTransferStatus,
  requiredApprovalSteps,
  shouldCountMatchBan,
} from "./engine";

describe("Phase 6 domain engines", () => {
  it("supports configurable transfer approval order", () => {
    const steps = requiredApprovalSteps(["DESTINATION_CLUB", "COMPETITION"], null, "club-b");
    expect(steps).toEqual(["DESTINATION_CLUB", "COMPETITION"]);
    expect(nextTransferStatus(steps, ["DESTINATION_CLUB"])).toBe("DESTINATION_CLUB_APPROVED");
    expect(nextTransferStatus(steps, steps)).toBe("COMPETITION_APPROVED");
  });

  it("evaluates all availability reasons at match time", () => {
    const periods = [
      { status: "INJURED" as const, reason: "Cedera", startsAt: new Date("2026-10-01"), endsAt: new Date("2026-10-10") },
      { status: "SUSPENDED" as const, reason: "Skorsing", startsAt: new Date("2026-10-03"), endsAt: new Date("2026-10-06") },
    ];
    expect(availabilityAt(periods, new Date("2026-10-05"))).toMatchObject({ available: false, reasons: ["Cedera", "Skorsing"] });
    expect(availabilityAt(periods, new Date("2026-10-12"))).toMatchObject({ available: true, status: "AVAILABLE" });
  });

  it("creates suspensions only from valid official cards without double counting corrections", () => {
    const specs = automaticSuspensionSpecs(
      [
        { id: "y1", playerId: "p", type: "YELLOW_CARD", isValid: true, matchStatus: "OFFICIAL" },
        { id: "y2", playerId: "p", type: "YELLOW_CARD", isValid: true, matchStatus: "OFFICIAL" },
        { id: "old", playerId: "p", type: "RED_CARD", isValid: false, matchStatus: "OFFICIAL" },
        { id: "live", playerId: "p", type: "RED_CARD", isValid: true, matchStatus: "LIVE_SECOND_HALF" },
        { id: "red", playerId: "p", type: "RED_CARD", isValid: true, matchStatus: "OFFICIAL" },
      ],
      "season",
      { yellowThreshold: 2, yellowMatchBans: 1, secondYellowMatchBans: 1, redCardMatchBans: 2 },
    );
    expect(specs.map((item) => item.sourceKey)).toEqual(["yellow:season:p:1", "red:red"]);
  });

  it("does not serve bans on cancelled or postponed matches", () => {
    expect(shouldCountMatchBan("OFFICIAL")).toBe(true);
    expect(shouldCountMatchBan("CANCELLED")).toBe(false);
    expect(shouldCountMatchBan("POSTPONED")).toBe(false);
  });
});
