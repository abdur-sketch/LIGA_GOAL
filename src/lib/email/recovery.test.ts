import { afterEach, describe, expect, it, vi } from "vitest";
import { recoveryEmailPayload, sendRecoveryEmail } from "./recovery";

afterEach(() => { delete process.env.EMAIL_PROVIDER_ENDPOINT; delete process.env.EMAIL_PROVIDER_TOKEN; });
describe("recovery email adapter", () => {
  it("keeps delivery blocked without explicit provider configuration", async () => { expect(await sendRecoveryEmail("user@example.test", "secret-token", vi.fn() as never)).toEqual({ status: "blocked" }); });
  it("builds an Indonesian expiry-aware template and retries transient failures", async () => {
    process.env.EMAIL_PROVIDER_ENDPOINT = "https://mail.example.test/send"; process.env.EMAIL_PROVIDER_TOKEN = "local-test-token"; process.env.NEXTAUTH_URL = "https://liga.example.test";
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 202 }));
    expect(await sendRecoveryEmail("user@example.test", "secret-token", fetcher)).toEqual({ status: "accepted" });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(recoveryEmailPayload("user@example.test", "secret-token").variables.expiresMinutes).toBe(30);
  });
});
