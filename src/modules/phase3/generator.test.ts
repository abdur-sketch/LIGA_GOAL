import { describe, expect, it } from "vitest";
import { generateBracket, generateRoundRobin } from "./generator";

describe("fixture generator", () => {
  it("generates six unique matches for four clubs", () => { const result = generateRoundRobin(["a","b","c","d"]); expect(result.fixtures).toHaveLength(6); expect(new Set(result.fixtures.map((item) => [item.homeClubId,item.awayClubId].sort().join(":"))).size).toBe(6); });
  it("generates twelve matches for a double round robin", () => { expect(generateRoundRobin(["a","b","c","d"], 2).fixtures).toHaveLength(12); });
  it("supports five clubs with ten matches and one bye per round", () => { const result = generateRoundRobin(["a","b","c","d","e"]); expect(result.fixtures).toHaveLength(10); expect(result.byes).toHaveLength(5); expect(result.rounds).toBe(5); });
  it("never creates self matches or duplicate pairs within one leg", () => { const result = generateRoundRobin(["a","b","c","d","e"]); expect(result.fixtures.every((item) => item.homeClubId !== item.awayClubId)).toBe(true); expect(new Set(result.fixtures.map((item) => [item.homeClubId,item.awayClubId].sort().join(":"))).size).toBe(result.fixtures.length); });
  it("creates an empty progression path without selecting winners", () => { const bracket = generateBracket(["a","b","c","d"] , true); expect(bracket).toHaveLength(3); expect(bracket.find((tie) => tie.round === 2)).toMatchObject({ homeClubId: null, awayClubId: null }); });
});
