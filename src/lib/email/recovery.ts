import { createHash } from "node:crypto";
import { log } from "@/lib/observability/logger";

type FetchLike = typeof fetch;
function emailHash(email: string) { return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16); }

export function recoveryEmailPayload(email: string, token: string) {
  const base = new URL(process.env.NEXTAUTH_URL || "http://127.0.0.1:3000");
  const resetUrl = new URL("/login", base); resetUrl.searchParams.set("recoveryToken", token);
  return { to: email, template: "liga-goal-password-recovery-v1", locale: "id", variables: { resetUrl: resetUrl.toString(), expiresMinutes: 30 } };
}

export async function sendRecoveryEmail(email: string, token: string, fetcher: FetchLike = fetch) {
  const endpoint = process.env.EMAIL_PROVIDER_ENDPOINT; const apiToken = process.env.EMAIL_PROVIDER_TOKEN;
  if (!endpoint || !apiToken) { log("warn", "recovery_delivery_unconfigured", { emailHash: emailHash(email) }); return { status: "blocked" as const }; }
  const payload = recoveryEmailPayload(email, token);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetcher(endpoint, { method: "POST", headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json", "idempotency-key": createHash("sha256").update(token).digest("hex") }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8_000) });
      if (response.ok) { log("info", "recovery_delivery_accepted", { emailHash: emailHash(email), attempt }); return { status: "accepted" as const }; }
      if (response.status < 500 && response.status !== 429) break;
    } catch { /* retry without logging token or provider body */ }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 50));
  }
  log("error", "recovery_delivery_failed", { emailHash: emailHash(email) });
  return { status: "failed" as const };
}
