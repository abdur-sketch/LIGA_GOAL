import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    environment: process.env.LIGA_GOAL_ENVIRONMENT || "unknown",
    version: process.env.APP_VERSION || "development",
    commit: process.env.APP_COMMIT_SHA?.slice(0, 12) || "unknown",
    uptimeSeconds: Math.floor(process.uptime()),
  }, { headers: { "cache-control": "no-store" } });
}
