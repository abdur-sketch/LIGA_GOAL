import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { deliverSandboxEmail } from "@/lib/email/verification";
import { resendInvitation, revokeInvitation } from "@/modules/phase13/service";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const actor = await getApiActor(); const { id } = await params; const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (body?.action === "revoke") { await revokeInvitation(actor, organizationId, id); return NextResponse.json({ status: "REVOKED" }); }
    if (body?.action === "resend") { const result = await resendInvitation(actor, organizationId, id); const delivery = await deliverSandboxEmail("invitation", result.email, result.token); return NextResponse.json({ status: "PENDING", previewUrl: delivery.previewUrl }); }
    throw new ApiError(422, "Aksi tidak valid.");
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
