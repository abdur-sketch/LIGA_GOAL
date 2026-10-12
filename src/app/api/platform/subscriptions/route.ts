import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { assignPlan, listPlatformSubscriptions, reconcileCounter, transitionSubscription, type MetricKey } from "@/modules/phase14/service";

function failure(error: unknown) { if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Data kontrol subscription tidak valid.", details: error.flatten() }, { status: 422 }); throw error; }
export async function GET() { try { return NextResponse.json({ data: await listPlatformSubscriptions(await getApiActor()) }); } catch (error) { return failure(error); } }
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json().catch(() => null); await enforceMutationRateLimit(rateLimitKey(["platform-subscription", actor.id, String(body?.organizationId || "unknown")]), 20, 60 * 60_000); if (body?.operation === "assign") return NextResponse.json({ data: await assignPlan(actor, body) }); if (body?.operation === "transition") return NextResponse.json({ data: await transitionSubscription(actor, body) }); if (body?.operation === "reconcile") return NextResponse.json({ data: await reconcileCounter(actor, String(body.organizationId), String(body.metricKey) as MetricKey, String(body.scopeKey || "organization"), String(body.reason || "")) }); throw new ApiError(422, "Operasi tidak valid."); } catch (error) { return failure(error); } }
