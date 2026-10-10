import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function accepted(provided: string | null, expected: string) {
  if (!provided?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(provided.slice(7));
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export async function GET(request: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return NextResponse.json({ error: "Metrics tidak dikonfigurasi." }, { status: 503 });
  if (!accepted(request.headers.get("authorization"), token)) return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
  const [liveMatches, failedJobs, pendingDeliveries] = await Promise.all([
    db.match.count({ where: { status: { in: ["LIVE_FIRST_HALF", "HALF_TIME", "LIVE_SECOND_HALF", "EXTRA_TIME", "PENALTY_SHOOTOUT"] } } }),
    db.backgroundJob.count({ where: { status: "failed" } }),
    db.notificationDelivery.count({ where: { status: "PENDING" } }),
  ]);
  const body = [
    "# HELP liga_goal_up Application database is reachable.",
    "# TYPE liga_goal_up gauge",
    "liga_goal_up 1",
    `liga_goal_live_matches ${liveMatches}`,
    `liga_goal_failed_jobs ${failedJobs}`,
    `liga_goal_pending_notification_deliveries ${pendingDeliveries}`,
    "",
  ].join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/plain; version=0.0.4", "cache-control": "no-store" } });
}
