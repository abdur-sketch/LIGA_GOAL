import { describe, expect, it } from "vitest";
import { evaluateEligibility } from "./eligibility";

const base = { status: "APPROVED", verificationStatus: "VERIFIED", dateOfBirth: new Date("2008-06-01"), jerseyNumber: 9, clubApproved: true, duplicateActiveRegistration: false, activeSquadCount: 3, jerseyConflict: false, approvedDocumentTypes: ["IDENTITY", "AGE_PROOF"], now: new Date("2026-01-01"), rules: { uniqueJersey: true, jerseyRequired: true, requiredDocuments: ["IDENTITY", "AGE_PROOF"] as ("IDENTITY" | "AGE_PROOF")[] }, suspension: { available: false } };

describe("eligibility engine", () => {
  it("returns eligible when every configured rule passes", () => { expect(evaluateEligibility(base)).toMatchObject({ result: "ELIGIBLE", reasons: [], suspensionCheck: "UNAVAILABLE" }); });
  it("keeps a registration pending when a required document is missing", () => { const result = evaluateEligibility({ ...base, approvedDocumentTypes: ["IDENTITY"] }); expect(result.result).toBe("PENDING_REVIEW"); expect(result.reasons.map((reason) => reason.code)).toContain("DOCUMENT_AGE_PROOF"); });
  it("rejects a player outside the configured age range", () => { const result = evaluateEligibility({ ...base, rules: { ...base.rules, age: { min: 19, max: 22, cutoffDate: "2026-01-01" } } }); expect(result.result).toBe("INELIGIBLE"); expect(result.reasons.map((reason) => reason.code)).toContain("AGE_BELOW_MINIMUM"); });
  it("enforces unique jersey and squad limit only when configured", () => { const result = evaluateEligibility({ ...base, jerseyConflict: true, activeSquadCount: 5, rules: { ...base.rules, squadLimit: 5 } }); expect(result.result).toBe("INELIGIBLE"); expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(["JERSEY_CONFLICT", "SQUAD_LIMIT"])); });
});
