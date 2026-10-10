import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", version: process.env.APP_VERSION || "development", uptimeSeconds: Math.floor(process.uptime()) }, { headers: { "cache-control": "no-store" } });
}
