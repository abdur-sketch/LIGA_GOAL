import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { deliverSandboxEmail } from "@/lib/email/verification";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { registerOrganizer } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "invalid";
    await Promise.all([
      enforceMutationRateLimit(rateLimitKey(["registration-ip", trustedClientAddress(request)]), 8, 15 * 60_000),
      enforceMutationRateLimit(rateLimitKey(["registration-email", email]), 4, 60 * 60_000),
    ]);
    const result = await registerOrganizer(body);
    const delivery = result.token ? await deliverSandboxEmail("verification", result.email, result.token) : null;
    return NextResponse.json({ message: "Jika pendaftaran dapat diproses, instruksi verifikasi tersedia melalui email sandbox.", previewUrl: delivery?.previewUrl }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    throw error;
  }
}
