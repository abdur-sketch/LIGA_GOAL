import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { simulatePayment } from "@/modules/phase15/service";
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json(); await enforceMutationRateLimit(rateLimitKey(["mock-payment", actor.id, body.organizationId]), 12, 60 * 60_000); return NextResponse.json({ data: await simulatePayment(actor, String(body.organizationId), String(body.attemptId), body.status) }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; } }
