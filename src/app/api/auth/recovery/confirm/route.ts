import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { confirmPasswordReset } from "@/modules/phase8/auth";

const schema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
});

export async function POST(request: NextRequest) {
  try {
    await enforceMutationRateLimit(rateLimitKey(["recovery-confirm", trustedClientAddress(request)]), 8, 15 * 60_000);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Token atau kata sandi tidak memenuhi ketentuan." }, { status: 422 });
    await confirmPasswordReset(parsed.data.token, parsed.data.password);
    return NextResponse.json({ message: "Kata sandi diperbarui. Semua sesi lama telah dicabut." });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
