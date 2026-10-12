import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { deliverSandboxEmail } from "@/lib/email/verification";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { createInvitation } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await getApiActor(); const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    await enforceMutationRateLimit(rateLimitKey(["org-invite", actor.id, organizationId]), 20, 60 * 60_000);
    const result = await createInvitation(actor, organizationId, body);
    const delivery = await deliverSandboxEmail("invitation", result.invitation.email, result.token);
    return NextResponse.json({ invitation: result.invitation, previewUrl: delivery.previewUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
