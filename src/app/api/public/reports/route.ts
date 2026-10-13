import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { sourceDigest, submitAbuseReport } from "@/modules/phase17/service";

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const agent = request.headers.get("user-agent") || "unknown";
  const fingerprint = `${forwarded}|${agent}`;
  try {
    await enforceMutationRateLimit(rateLimitKey(["public-abuse-report", sourceDigest(fingerprint)]), 5, 60 * 60_000);
    const data = await submitAbuseReport(await request.json().catch(() => null), fingerprint);
    return NextResponse.json({ data, message: "Laporan telah diterima untuk ditinjau." }, { status: 202 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.status === 404 ? "Konten publik tidak ditemukan." : error.message }, { status: error.status });
    if (error instanceof ZodError) return NextResponse.json({ error: "Laporan tidak valid.", details: error.flatten() }, { status: 422 });
    throw error;
  }
}
