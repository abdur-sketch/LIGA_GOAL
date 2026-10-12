import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { respondToInvitation } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await getApiActor(); const body = await request.json().catch(() => null);
    await enforceMutationRateLimit(rateLimitKey(["invite-response", actor.id]), 12, 15 * 60_000);
    if (body?.action !== "accept" && body?.action !== "decline") throw new ApiError(422, "Aksi tidak valid.");
    return NextResponse.json(await respondToInvitation(actor, body, body.action));
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
