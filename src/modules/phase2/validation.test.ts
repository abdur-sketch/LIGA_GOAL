import { describe, expect, it } from "vitest";
import { competitionRulesSchema } from "./validation";

describe("competitionRulesSchema", () => {
  it("accepts the complete bounded document type set", () => {
    const requiredDocuments = ["PHOTO", "IDENTITY", "AGE_PROOF", "PARENTAL_CONSENT", "ADDITIONAL"] as const;
    expect(competitionRulesSchema.parse({ requiredDocuments }).requiredDocuments).toEqual(requiredDocuments);
  });

  it("rejects oversized document arrays before business processing", () => {
    const requiredDocuments = Array.from({ length: 6 }, () => "PHOTO");
    expect(competitionRulesSchema.safeParse({ requiredDocuments }).success).toBe(false);
  });
});
