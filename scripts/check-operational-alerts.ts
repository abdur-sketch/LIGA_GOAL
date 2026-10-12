import { db } from "../src/lib/db";
import { deliverAlert, thresholdAlerts } from "../src/lib/observability/alerts";
import { rootDb } from "../src/lib/db";
import { withJobDatabase } from "../src/lib/tenant-db";

async function main() {
  let databaseUp = true;
  let failedJobs = 0;
  let pendingNotifications = 0;
  let realtimeDelaySeconds = 0;
  try {
    const [jobs, notifications, oldest] = await withJobDatabase(null, () =>
      Promise.all([
        db.backgroundJob.count({ where: { status: "failed" } }),
        db.notificationDelivery.count({ where: { status: "PENDING" } }),
        db.matchRealtimeOutbox.findFirst({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]),
    );
    failedJobs = jobs;
    pendingNotifications = notifications;
    realtimeDelaySeconds = oldest
      ? Math.max(0, (Date.now() - oldest.createdAt.valueOf()) / 1000)
      : 0;
  } catch {
    databaseUp = false;
  }
  const lastBackupAt = process.env.LAST_BACKUP_AT
    ? new Date(process.env.LAST_BACKUP_AT)
    : null;
  const backupAgeHours =
    lastBackupAt && !Number.isNaN(lastBackupAt.valueOf())
      ? (Date.now() - lastBackupAt.valueOf()) / 3_600_000
      : Number.POSITIVE_INFINITY;
  const alerts = thresholdAlerts({
    databaseUp,
    failedJobs,
    pendingNotifications,
    realtimeDelaySeconds,
    backupAgeHours,
  });
  const deliveries = await Promise.all(
    alerts.map((alert) => deliverAlert(alert)),
  );
  console.log(
    JSON.stringify({
      alertCount: alerts.length,
      statuses: deliveries.map((item) => item.status),
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => rootDb.$disconnect());
