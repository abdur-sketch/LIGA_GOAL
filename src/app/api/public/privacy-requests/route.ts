import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { captureError } from "@/lib/observability/logger";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { submitPrivacyRequest } from "@/modules/phase22/service";

export async function POST(request: NextRequest) {
  try {
    await enforceMutationRateLimit(rateLimitKey(["privacy-request", trustedClientAddress(request)]), 5, 60 * 60_000);
    return NextResponse.json({ data: await submitPrivacyRequest(await request.json()) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: "Permintaan privasi tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
    captureError("privacy_request_failed", error);
    return NextResponse.json({ error: "Permintaan belum dapat diproses." }, { status: 500 });
  }
}
