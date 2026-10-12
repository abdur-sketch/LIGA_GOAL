import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { grantPublicationConsent } from "@/modules/phase9/privacy";
import { withRuntimeDatabaseRoute } from "@/lib/runtime-route";

async function POSTHandler(request: Request) { try { return NextResponse.json({ data: await grantPublicationConsent(await getApiActor(), await request.json()) }, { status: 201 }); } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 }); throw error; } }

export const POST = withRuntimeDatabaseRoute(POSTHandler);
