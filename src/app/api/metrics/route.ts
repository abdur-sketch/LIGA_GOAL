import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { withJobDatabase } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

function accepted(provided: string | null, expected: string) {
  if (!provided?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(provided.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export async function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (!token)
    return NextResponse.json(
      { error: "Metrics tidak dikonfigurasi." },
      { status: 503 },
    );
  if (!accepted(request.headers.get("authorization"), token))
    return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  const [liveMatches, failedJobs, pendingDeliveries, pendingRegistrations, pendingApprovals, activeJudges, privacyRequests, recentRegistrationRejects, databaseCapacity] = await withJobDatabase(
    null,
    () =>
      Promise.all([
        db.match.count({
          where: {
            status: {
              in: [
                "LIVE_FIRST_HALF",
                "HALF_TIME",
                "LIVE_SECOND_HALF",
                "EXTRA_TIME",
                "PENALTY_SHOOTOUT",
              ],
            },
          },
        }),
        db.backgroundJob.count({ where: { status: "failed" } }),
        db.notificationDelivery.count({ where: { status: "PENDING" } }),
        db.publicRegistration.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"] } } }),
        db.resultApprovalWorkflow.count({ where: { status: { in: ["SUBMITTED", "REVIEWED", "APPROVED"] } } }),
        db.judgeAssignment.count({ where: { status: "ACTIVE", OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] } }),
        db.privacyDataRequest.count({ where: { status: { notIn: ["REJECTED", "COMPLETED"] } } }),
        db.auditLog.count({ where: { action: "REJECT", resourceType: "PUBLIC_REGISTRATION", createdAt: { gte: new Date(Date.now() - 5 * 60_000) } } }),
        db.$queryRaw<Array<{ connections: bigint; max_connections: number; size_bytes: bigint }>>`SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()) AS connections, current_setting('max_connections')::int AS max_connections, pg_database_size(current_database()) AS size_bytes`,
      ]),
  );
  const body = [
    "# HELP liga_goal_up Application database is reachable.",
    "# TYPE liga_goal_up gauge",
    "liga_goal_up 1",
    `liga_goal_live_matches ${liveMatches}`,
    `liga_goal_failed_jobs ${failedJobs}`,
    `liga_goal_pending_notification_deliveries ${pendingDeliveries}`,
    `portal_lomba_pending_public_registrations ${pendingRegistrations}`,
    `portal_lomba_pending_result_approvals ${pendingApprovals}`,
    `portal_lomba_active_judge_assignments ${activeJudges}`,
    `portal_lomba_pending_privacy_requests ${privacyRequests}`,
    `portal_lomba_registration_rejections_5m ${recentRegistrationRejects}`,
    `portal_lomba_database_connections ${databaseCapacity[0]?.connections ?? 0}`,
    `portal_lomba_database_max_connections ${databaseCapacity[0]?.max_connections ?? 0}`,
    `portal_lomba_database_size_bytes ${databaseCapacity[0]?.size_bytes ?? 0}`,
    "",
  ].join("\n");
  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; version=0.0.4",
      "cache-control": "no-store",
    },
  });
}
