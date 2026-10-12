import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { trustedClientAddress } from "@/lib/security/rate-limit";
import { provisionOrganization } from "@/modules/phase13/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await getApiActor();
    const organization = await provisionOrganization(actor, await request.json().catch(() => null), { requestId: request.headers.get("x-request-id") || randomUUID(), ip: trustedClientAddress(request), userAgent: request.headers.get("user-agent") || undefined });
    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    throw error;
  }
}
