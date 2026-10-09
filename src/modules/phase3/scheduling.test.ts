import { describe, expect, it } from "vitest";
import { validateSchedule } from "./scheduling";
const context = { seasonStart: new Date("2026-01-01"), seasonEnd: new Date("2026-12-31"), registeredClubIds: new Set(["a","b","c","d"]), minimumRestHours: 24, matchDurationMinutes: 120 };
describe("schedule validation", () => {
  it("detects venue and referee conflicts", () => { const kickoffAt = new Date("2026-05-01T10:00:00Z"); const result = validateSchedule([{ id: "1", homeClubId: "a", awayClubId: "b", venueId: "v", refereeId: "r", kickoffAt }, { id: "2", homeClubId: "c", awayClubId: "d", venueId: "v", refereeId: "r", kickoffAt }], context); expect(result.map((item) => item.code)).toEqual(expect.arrayContaining(["VENUE_CONFLICT","REFEREE_CONFLICT"])); });
  it("rejects unregistered clubs and self matches", () => { const result = validateSchedule([{ id: "1", homeClubId: "x", awayClubId: "x", venueId: "v", kickoffAt: new Date("2026-05-01") }], context); expect(result.map((item) => item.code)).toEqual(expect.arrayContaining(["CLUB_NOT_REGISTERED","SELF_MATCH"])); });
});
