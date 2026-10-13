import { NextResponse } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { platformAuditFeed } from "@/modules/phase17/service";

export async function GET() {
  try { return NextResponse.json({ data: await platformAuditFeed(await getApiActor()) }); }
  catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
}
