import { describe, expect, it } from "vitest";
import { invitationEmailPayload, verificationEmailPayload } from "@/lib/email/verification";
import { onboardingSchema, registrationSchema } from "./validation";
import { tokenDigest } from "./service";

describe("Phase 13 validation and token safety", () => {
  it("requires a strong password and rejects bot honeypot data", () => {
    expect(registrationSchema.safeParse({ name: "Test", email: "USER@EXAMPLE.TEST", password: "weak", website: "" }).success).toBe(false);
    expect(registrationSchema.parse({ name: "Test User", email: "USER@EXAMPLE.TEST", password: "Strong!Password1", website: "" }).email).toBe("user@example.test");
  });

  it("requires explicit, versioned consent", () => {
    const input = { organizationName: "Liga Test", slug: "liga-test", organizerType: "COMMUNITY", region: "Bandung", contactEmail: "owner@example.test", termsAccepted: false, privacyAccepted: true, termsVersion: "v1", privacyVersion: "v1", idempotencyKey: crypto.randomUUID() };
    expect(onboardingSchema.safeParse(input).success).toBe(false);
  });

  it("stores opaque token digests and produces local adapter URLs", () => {
    expect(tokenDigest("raw-secret")).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenDigest("raw-secret")).not.toContain("raw-secret");
    expect(verificationEmailPayload("a@example.test", "token").variables.verificationUrl).toContain("/verifikasi-email?token=token");
    expect(invitationEmailPayload("a@example.test", "token").variables.invitationUrl).toContain("/undangan?token=token");
  });
});
