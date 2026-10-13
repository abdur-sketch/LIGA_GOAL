import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { submitModerationAppeal } from "@/modules/phase17/service";
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json().catch(() => null); await enforceMutationRateLimit(rateLimitKey(["moderation-appeal", actor.id, String(body?.organizationId || "unknown")]), 3, 24*60*60_000); return NextResponse.json({ data: await submitModerationAppeal(actor, body) }, { status: 201 }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Appeal tidak valid.", details: error.flatten() }, { status: 422 }); throw error; } }
