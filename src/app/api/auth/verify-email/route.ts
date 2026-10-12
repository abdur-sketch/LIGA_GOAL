import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { verifyEmail } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    await enforceMutationRateLimit(rateLimitKey(["verify-email", trustedClientAddress(request)]), 12, 15 * 60_000);
    await verifyEmail(await request.json().catch(() => null));
    return NextResponse.json({ message: "Email berhasil diverifikasi. Silakan masuk." });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
