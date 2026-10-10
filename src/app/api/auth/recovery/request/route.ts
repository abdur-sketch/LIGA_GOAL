import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { requestPasswordReset } from "@/modules/phase8/auth";
import { ApiError } from "@/lib/auth/api";

const schema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) });

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Data tidak valid." }, { status: 422 });
    await enforceMutationRateLimit(rateLimitKey(["recovery", trustedClientAddress(request), parsed.data.email]), 5, 15 * 60_000);
    const token = await requestPasswordReset(parsed.data.email);
    const preview = process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_RECOVERY_PREVIEW === "true" && token
      ? { previewToken: token }
      : {};
    return NextResponse.json({ message: "Jika akun tersedia, instruksi pemulihan akan dikirim.", ...preview }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
