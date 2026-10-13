import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverAlert, thresholdAlerts } from "./alerts";
afterEach(() => { delete process.env.ALERT_WEBHOOK_URL; delete process.env.ALERT_WEBHOOK_TOKEN; });
describe("operational alert adapter", () => {
  it("detects database, realtime, job, notification, and backup thresholds", () => { expect(thresholdAlerts({ databaseUp: false, failedJobs: 1, pendingNotifications: 101, realtimeDelaySeconds: 31, backupAgeHours: 27 })).toHaveLength(5); });
  it("does not call an external service until explicitly configured", async () => { const fetcher = vi.fn(); expect(await deliverAlert({ key: "test", severity: "warning", summary: "test", value: 1, threshold: 0, occurredAt: new Date().toISOString() }, fetcher as never)).toEqual({ status: "blocked" }); expect(fetcher).not.toHaveBeenCalled(); });
  it("delivers an authenticated JSON alert to a configured webhook", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/events";
    process.env.ALERT_WEBHOOK_TOKEN = "sandbox-secret";
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    const alert = { key: "database_unavailable", severity: "critical" as const, summary: "Database readiness failed", value: 0, threshold: 1, occurredAt: "2026-10-13T00:00:00.000Z" };
    await expect(deliverAlert(alert, fetcher as never)).resolves.toEqual({ status: "accepted" });
    expect(fetcher).toHaveBeenCalledWith("https://alerts.example.test/events", expect.objectContaining({
      method: "POST",
      headers: { authorization: "Bearer sandbox-secret", "content-type": "application/json" },
      body: JSON.stringify(alert),
    }));
  });
  it("retries transient failures and stops after acceptance", async () => {
    process.env.ALERT_WEBHOOK_URL = "https://alerts.example.test/events";
    process.env.ALERT_WEBHOOK_TOKEN = "sandbox-secret";
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deliverAlert({ key: "realtime_delay", severity: "critical", summary: "Realtime delay exceeded", value: 31, threshold: 30, occurredAt: "2026-10-13T00:00:00.000Z" }, fetcher as never)).resolves.toEqual({ status: "accepted" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
