import { createHash } from "node:crypto";
import { log } from "@/lib/observability/logger";

function localUrl(path: string, token: string) {
  const url = new URL(path, process.env.NEXTAUTH_URL || "http://127.0.0.1:3000");
  url.searchParams.set("token", token);
  return url.toString();
}

export function verificationEmailPayload(email: string, token: string) {
  return { to: email, template: "liga-goal-email-verification-v1", locale: "id", variables: { verificationUrl: localUrl("/verifikasi-email", token), expiresMinutes: 30 } };
}

export function invitationEmailPayload(email: string, token: string) {
  return { to: email, template: "liga-goal-organization-invitation-v1", locale: "id", variables: { invitationUrl: localUrl("/undangan", token), expiresDays: 7 } };
}

export async function deliverSandboxEmail(kind: "verification" | "invitation", email: string, token: string) {
  const url = kind === "verification" ? verificationEmailPayload(email, token).variables.verificationUrl : invitationEmailPayload(email, token).variables.invitationUrl;
  log("info", "sandbox_email_prepared", { kind, emailHash: createHash("sha256").update(email).digest("hex").slice(0, 16) });
  return { status: "sandbox" as const, previewUrl: process.env.NODE_ENV === "production" ? undefined : url };
}
