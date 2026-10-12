import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { processMockWebhook } from "@/modules/phase15/service";
export async function POST(request: NextRequest) { try { const raw = await request.text(); const result = await processMockWebhook(raw, request.headers.get("x-liga-goal-mock-signature")); return NextResponse.json({ received: true, data: result }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ received: false, error: error.message }, { status: error.status }); if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ received: false, error: "Payload webhook tidak valid." }, { status: 422 }); throw error; } }
