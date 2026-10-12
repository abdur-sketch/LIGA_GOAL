import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { approveRefund, financeOverview, reconcileInvoice } from "@/modules/phase15/service";
function failure(error: unknown) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
export async function GET() { try { return NextResponse.json({ data: await financeOverview(await getApiActor()) }); } catch (error) { return failure(error); } }
export async function POST(request: NextRequest) { try { const actor = await getApiActor(); const body = await request.json(); await enforceMutationRateLimit(rateLimitKey(["platform-finance", actor.id]), 20, 60 * 60_000); if (body.operation === "approve_refund") return NextResponse.json({ data: await approveRefund(actor, String(body.refundId), String(body.reason || "")) }); if (body.operation === "reconcile") return NextResponse.json({ data: await reconcileInvoice(actor, String(body.invoiceId)) }); throw new ApiError(422, "Operasi finance tidak valid."); } catch (error) { return failure(error); } }
