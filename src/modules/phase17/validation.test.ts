import { describe, expect, it } from "vitest";
import { abuseReportSchema, moderationReviewSchema, verificationReviewSchema, verificationSubmissionSchema } from "./validation";
import { sourceDigest } from "./service";

describe("Phase 17 validation", () => {
  it("accepts bounded verification evidence and hashes request context", () => {
    expect(verificationSubmissionSchema.parse({ organizationId: "org-1", evidence: { registrationNumber: "AHU-123" } }).evidence).toEqual({ registrationNumber: "AHU-123" });
    expect(sourceDigest("127.0.0.1|test-agent")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects short abuse and moderation narratives", () => {
    expect(() => abuseReportSchema.parse({ targetType: "ORGANIZER", targetId: "id", category: "OTHER", description: "too short" })).toThrow();
    expect(() => moderationReviewSchema.parse({ reportId: "id", version: 1, action: "dismiss", reason: "short" })).toThrow();
    expect(() => verificationReviewSchema.parse({ id: "id", version: 0, action: "verify", reason: "long enough reason" })).toThrow();
  });
});
