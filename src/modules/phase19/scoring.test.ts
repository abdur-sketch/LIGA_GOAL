import { describe, expect, it } from "vitest";
import { calculateRanking } from "./scoring";

describe("phase 19 generic scoring", () => {
  it("menghitung bobot, penalti, dan peringkat seri secara deterministik", () => {
    expect(calculateRanking([
      { entryId: "b", score: 80, penalty: 5, weight: 0.5 },
      { entryId: "a", score: 70, penalty: 0, weight: 0.5 },
      { entryId: "a", score: 10, penalty: 0 },
      { entryId: "b", score: 5, penalty: 0 },
      { entryId: "c", score: 30, penalty: 0 },
    ])).toEqual([
      { entryId: "a", totalScore: 45, rank: 1 },
      { entryId: "b", totalScore: 40, rank: 2 },
      { entryId: "c", totalScore: 30, rank: 3 },
    ]);
  });

  it("memberikan rank yang sama untuk skor seri", () => {
    expect(calculateRanking([{ entryId: "a", score: 10, penalty: 0 }, { entryId: "b", score: 10, penalty: 0 }]).map((item) => item.rank)).toEqual([1, 1]);
  });
});
