import { NextResponse } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { revokeAllSessions } from "@/modules/phase8/auth";

export async function POST() {
  try {
    const actor = await getApiActor();
    await revokeAllSessions(actor.id);
    return NextResponse.json({ message: "Semua sesi telah dicabut." });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
