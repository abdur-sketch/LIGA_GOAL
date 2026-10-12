import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { withdrawPublicationConsent } from "@/modules/phase9/privacy";
import { withRuntimeDatabaseRoute } from "@/lib/runtime-route";

async function DELETEHandler(request: Request, context: { params: Promise<{ id: string }> }) { try { const { id } = await context.params; return NextResponse.json({ data: await withdrawPublicationConsent(await getApiActor(), id, await request.json()) }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 }); throw error; } }

export const DELETE = withRuntimeDatabaseRoute(DELETEHandler);
