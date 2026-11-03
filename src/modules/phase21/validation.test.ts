import { describe, expect, it } from "vitest";
import { judgeAssignmentSchema, publicRegistrationSchema, registrationConfigSchema, resultWorkflowSchema } from "./validation";

describe("Phase 21 validation", () => {
  it("requires conflict notes and a valid assignment period", () => {
    expect(judgeAssignmentSchema.safeParse({ organizationId: "org", competitionId: "comp", judgeId: "judge", conflictDeclared: true, idempotencyKey: "assignment:123456" }).success).toBe(false);
    expect(judgeAssignmentSchema.safeParse({ organizationId: "org", competitionId: "comp", judgeId: "judge", validFrom: "2026-11-02", validUntil: "2026-11-01", idempotencyKey: "assignment:123456" }).success).toBe(false);
  });

  it("rejects malformed public submissions and unsafe document paths", () => {
    expect(publicRegistrationSchema.safeParse({ publicSlug: "pilot-lct", participantType: "TEAM", participantName: "A", contactEmail: "invalid", teamData: {}, formData: {}, documents: [{ storageKey: "../secret", originalName: "x", mimeType: "application/pdf", sizeBytes: 1 }], idempotencyKey: "registration:123456" }).success).toBe(false);
  });

  it("requires recorded privacy and guardian consent for a minor", () => {
    const base = { publicSlug: "pilot-lct", participantType: "INDIVIDUAL", participantName: "Peserta Anak", contactEmail: "wali@example.test", teamData: {}, formData: {}, documents: [], idempotencyKey: "registration:minor:123", privacyAccepted: true, privacyVersion: "phase22-draft-2026-11-01", processingContext: {}, isMinor: true };
    expect(publicRegistrationSchema.safeParse(base).success).toBe(false);
    expect(publicRegistrationSchema.safeParse({ ...base, guardianName: "Wali Peserta", guardianContact: "080000000", guardianConsent: true }).success).toBe(true);
  });

  it("requires a reason when reopening approved results", () => {
    expect(resultWorkflowSchema.safeParse({ organizationId: "org", competitionId: "comp", sessionId: "session", action: "reopen" }).success).toBe(false);
    expect(resultWorkflowSchema.safeParse({ organizationId: "org", competitionId: "comp", sessionId: "session", action: "reopen", reason: "Koreksi resmi" }).success).toBe(true);
  });

  it("rejects a registration window that closes before it opens", () => {
    expect(registrationConfigSchema.safeParse({ organizationId: "org", competitionId: "comp", enabled: true, opensAt: "2026-11-02", closesAt: "2026-11-01", requirements: [] }).success).toBe(false);
  });

  it("accepts only a safe public registration slug", () => {
    expect(registrationConfigSchema.safeParse({ organizationId: "org", competitionId: "comp", publicSlug: "lct-kabupaten-2026", enabled: true, requirements: [] }).success).toBe(true);
    expect(registrationConfigSchema.safeParse({ organizationId: "org", competitionId: "comp", publicSlug: "../Rahasia", enabled: true, requirements: [] }).success).toBe(false);
  });
});
