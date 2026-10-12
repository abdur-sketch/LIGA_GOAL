import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverAlert, thresholdAlerts } from "./alerts";
afterEach(() => { delete process.env.ALERT_WEBHOOK_URL; delete process.env.ALERT_WEBHOOK_TOKEN; });
describe("operational alert adapter", () => {
  it("detects database, realtime, job, notification, and backup thresholds", () => { expect(thresholdAlerts({ databaseUp: false, failedJobs: 1, pendingNotifications: 101, realtimeDelaySeconds: 31, backupAgeHours: 27 })).toHaveLength(5); });
  it("does not call an external service until explicitly configured", async () => { const fetcher = vi.fn(); expect(await deliverAlert({ key: "test", severity: "warning", summary: "test", value: 1, threshold: 0, occurredAt: new Date().toISOString() }, fetcher as never)).toEqual({ status: "blocked" }); expect(fetcher).not.toHaveBeenCalled(); });
});
