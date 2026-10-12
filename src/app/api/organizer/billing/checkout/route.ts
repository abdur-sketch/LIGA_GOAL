import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { createCheckout } from "@/modules/phase15/service";
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json(); await enforceMutationRateLimit(rateLimitKey(["billing-checkout", actor.id, body.organizationId]), 10, 60 * 60_000); return NextResponse.json({ data: await createCheckout(actor, body) }, { status: 201 }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Checkout tidak valid.", details: error.flatten() }, { status: 422 }); throw error; } }
