import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready", checks: { database: "ok" } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    log("error", "readiness_failed", { error });
    return NextResponse.json({ status: "not_ready", checks: { database: "failed" } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
