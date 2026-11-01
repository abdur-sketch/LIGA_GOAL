import { createHash } from "node:crypto";

const REDACTED_KEYS = /password|token|secret|authorization|cookie|identity|document|email|phone|contact|guardian|address|birth|participant|ip/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED]";
  if (value instanceof Error) return { name: value.name, fingerprint: createHash("sha256").update(`${value.name}:${value.message}`).digest("hex").slice(0, 16) };
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, REDACTED_KEYS.test(key) ? "[REDACTED]" : sanitize(item, depth + 1)]));
  }
  return value;
}

export function log(level: "info" | "warn" | "error", event: string, context: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...sanitize(context) as object });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function captureError(event: string, error: unknown, context: Record<string, unknown> = {}) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : String(error);
  const fingerprint = createHash("sha256").update(`${name}:${message}`).digest("hex").slice(0, 16);
  log("error", event, { ...context, error: { name, fingerprint } });
  return fingerprint;
}
