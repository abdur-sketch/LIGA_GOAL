import { log } from "./logger";

export type OperationalAlert = { key: string; severity: "warning" | "critical"; summary: string; value: number; threshold: number; occurredAt: string };
type FetchLike = typeof fetch;

export async function deliverAlert(alert: OperationalAlert, fetcher: FetchLike = fetch) {
  const endpoint = process.env.ALERT_WEBHOOK_URL; const token = process.env.ALERT_WEBHOOK_TOKEN;
  if (!endpoint || !token) { log("warn", "alert_delivery_unconfigured", { key: alert.key, severity: alert.severity }); return { status: "blocked" as const }; }
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try { const response = await fetcher(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(alert), signal: AbortSignal.timeout(8_000) }); if (response.ok) return { status: "accepted" as const }; if (response.status < 500 && response.status !== 429) break; } catch { /* retry */ }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 50));
  }
  log("error", "alert_delivery_failed", { key: alert.key, severity: alert.severity }); return { status: "failed" as const };
}

export function thresholdAlerts(input: { databaseUp: boolean; failedJobs: number; pendingNotifications: number; realtimeDelaySeconds: number; backupAgeHours: number }) {
  const now = new Date().toISOString(); const alerts: OperationalAlert[] = [];
  if (!input.databaseUp) alerts.push({ key: "database_unavailable", severity: "critical", summary: "Database readiness failed", value: 0, threshold: 1, occurredAt: now });
  if (input.failedJobs > 0) alerts.push({ key: "failed_jobs", severity: "warning", summary: "Background jobs failed", value: input.failedJobs, threshold: 0, occurredAt: now });
  if (input.pendingNotifications > 100) alerts.push({ key: "notification_backlog", severity: "warning", summary: "Notification backlog exceeded", value: input.pendingNotifications, threshold: 100, occurredAt: now });
  if (input.realtimeDelaySeconds > 30) alerts.push({ key: "realtime_delay", severity: "critical", summary: "Realtime delay exceeded", value: input.realtimeDelaySeconds, threshold: 30, occurredAt: now });
  if (input.backupAgeHours > 26) alerts.push({ key: "backup_stale", severity: "critical", summary: "Latest backup is stale", value: input.backupAgeHours, threshold: 26, occurredAt: now });
  return alerts;
}
