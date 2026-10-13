import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { addModerationNote, changeOrganizationState, platformOperationsOverview, reviewAbuseReport, reviewModerationAppeal, reviewOrganizerVerification } from "@/modules/phase17/service";

function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Operasi platform tidak valid.", details: error.flatten() }, { status: 422 });
  throw error;
}
export async function GET() { try { return NextResponse.json({ data: await platformOperationsOverview(await getApiActor()) }); } catch (error) { return failure(error); } }
export async function POST(request: NextRequest) {
  try {
    const actor = await getApiActor(); const body = await request.json().catch(() => null);
    await enforceMutationRateLimit(rateLimitKey(["platform-operations", actor.id]), 60, 60 * 60_000);
    if (body?.operation === "verification") return NextResponse.json({ data: await reviewOrganizerVerification(actor, body.data) });
    if (body?.operation === "moderation") return NextResponse.json({ data: await reviewAbuseReport(actor, body.data) });
    if (body?.operation === "note") return NextResponse.json({ data: await addModerationNote(actor, body.data) }, { status: 201 });
    if (body?.operation === "appeal") return NextResponse.json({ data: await reviewModerationAppeal(actor, body.data) });
    if (body?.operation === "organization") return NextResponse.json({ data: await changeOrganizationState(actor, body.data) });
    throw new ApiError(422, "Operasi platform tidak dikenal.");
  } catch (error) { return failure(error); }
}
