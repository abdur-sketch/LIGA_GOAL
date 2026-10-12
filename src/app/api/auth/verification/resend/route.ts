import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { deliverSandboxEmail } from "@/lib/email/verification";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { resendVerification } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "invalid";
    await enforceMutationRateLimit(rateLimitKey(["verify-resend", trustedClientAddress(request), email]), 4, 60 * 60_000);
    const result = await resendVerification(body);
    const delivery = result.token ? await deliverSandboxEmail("verification", result.email, result.token) : null;
    return NextResponse.json({ message: "Jika akun tersedia, instruksi verifikasi akan dikirim.", previewUrl: delivery?.previewUrl }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
