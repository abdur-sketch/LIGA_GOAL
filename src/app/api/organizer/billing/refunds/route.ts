import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { requestRefund } from "@/modules/phase15/service";
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json(); await enforceMutationRateLimit(rateLimitKey(["refund-request", actor.id, body.organizationId]), 5, 24 * 60 * 60_000); return NextResponse.json({ data: await requestRefund(actor, body) }, { status: 201 }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Permintaan refund tidak valid.", details: error.flatten() }, { status: 422 }); throw error; } }
