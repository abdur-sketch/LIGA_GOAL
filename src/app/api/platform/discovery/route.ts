import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { discoveryModerationQueue, moderateDiscoveryPublication } from "@/modules/phase16/service";

function failure(error: unknown) { if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Tindakan moderasi tidak valid.", details: error.flatten() }, { status: 422 }); throw error; }
export async function GET() { try { return NextResponse.json({ data: await discoveryModerationQueue(await getApiActor()) }); } catch (error) { return failure(error); } }
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json().catch(() => null); await enforceMutationRateLimit(rateLimitKey(["platform-discovery", actor.id]), 60, 60 * 60_000); return NextResponse.json({ data: await moderateDiscoveryPublication(actor, body) }); } catch (error) { return failure(error); } }
