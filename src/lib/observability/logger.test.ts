import { afterEach, describe, expect, it, vi } from "vitest";
import { captureError, log } from "./logger";

afterEach(() => vi.restoreAllMocks());
describe("PII-safe structured logger", () => {
  it("redacts participant and contact fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    log("info", "registration", { participantName: "Anak Test", contactEmail: "private@example.test", status: "SUBMITTED" });
    const entry = JSON.parse(String(spy.mock.calls[0][0]));
    expect(entry.participantName).toBe("[REDACTED]"); expect(entry.contactEmail).toBe("[REDACTED]"); expect(entry.status).toBe("SUBMITTED");
  });
  it("captures only an opaque error fingerprint", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fingerprint = captureError("request_failed", new Error("email private@example.test failed"));
    expect(fingerprint).toMatch(/^[a-f0-9]{16}$/); expect(String(spy.mock.calls[0][0])).not.toContain("private@example.test");
  });
  it("does not expose messages when an Error reaches the generic logger", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    log("error", "readiness_failed", { error: new Error("participant child@example.test") });
    const output = String(spy.mock.calls[0][0]);
    expect(output).not.toContain("child@example.test"); expect(output).toMatch(/fingerprint/);
  });
});
