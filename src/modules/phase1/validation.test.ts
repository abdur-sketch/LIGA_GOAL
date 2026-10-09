import { describe, expect, it } from "vitest";
import { competitionSchema, seasonSchema, venueSchema } from "./validation";

describe("Phase 1 validation", () => {
  it("rejects an invalid competition period", () => {
    const result = competitionSchema.safeParse({ name: "Liga U-17", slug: "liga-u17", format: "SINGLE_ROUND_ROBIN", status: "DRAFT", startsAt: "2026-10-20", endsAt: "2026-10-10" });
    expect(result.success).toBe(false);
  });

  it("accepts configurable points and tie breakers", () => {
    const result = seasonSchema.parse({ competitionId: "cm12345678901234567890123", name: "2026", startsAt: "2026-01-01", endsAt: "2026-12-31", status: "ACTIVE", isActive: true, winPoints: 3, drawPoints: 1, lossPoints: 0, tieBreakers: ["points", "head_to_head"] });
    expect(result.tieBreakers).toEqual(["points", "head_to_head"]);
  });

  it("rejects negative venue capacity", () => {
    expect(venueSchema.safeParse({ name: "Lapangan Utama", capacity: -1, status: "AVAILABLE", timezone: "Asia/Jakarta" }).success).toBe(false);
  });
});
