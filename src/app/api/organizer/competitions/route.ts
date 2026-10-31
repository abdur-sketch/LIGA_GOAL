import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { withRuntimeDatabaseRoute } from "@/lib/runtime-route";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  createCompetitionSession,
  createGenericCompetition,
  createParticipant,
  createScoringCriterion,
  getMultiCompetitionWorkspace,
  publishCompetitionSession,
  publishGenericResults,
  recordGenericScore,
  registerGenericEntry,
} from "@/modules/phase19/service";
import { phase19ActionSchema } from "@/modules/phase19/validation";

function errorResponse(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data kompetisi tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Data tersebut sudah digunakan." }, { status: 409 });
  console.error("phase19-organizer-api", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

async function GETHandler(request: NextRequest) {
  try {
    const actor = await getApiActor();
    const data = await getMultiCompetitionWorkspace(actor, request.nextUrl.searchParams.get("organizationId") || undefined);
    if (!data) throw new ApiError(404, "Workspace organisasi belum tersedia.");
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const actor = await getApiActor();
    await enforceMutationRateLimit(`${actor.id}:phase19:mutation`, 30);
    const input = phase19ActionSchema.parse(await request.json());
    if (input.action === "create-competition") return NextResponse.json({ data: await createGenericCompetition(actor, input.data) }, { status: 201 });
    if (input.action === "create-participant") return NextResponse.json({ data: await createParticipant(actor, input.data) }, { status: 201 });
    if (input.action === "register-entry") return NextResponse.json({ data: await registerGenericEntry(actor, input.data) }, { status: 201 });
    if (input.action === "create-session") return NextResponse.json({ data: await createCompetitionSession(actor, input.data) }, { status: 201 });
    if (input.action === "publish-session") return NextResponse.json({ data: await publishCompetitionSession(actor, input.data) });
    if (input.action === "create-criterion") return NextResponse.json({ data: await createScoringCriterion(actor, input.data) }, { status: 201 });
    if (input.action === "record-score") return NextResponse.json({ data: await recordGenericScore(actor, input.data) }, { status: 201 });
    return NextResponse.json({ data: await publishGenericResults(actor, input.data) });
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = withRuntimeDatabaseRoute(GETHandler);
export const POST = withRuntimeDatabaseRoute(POSTHandler);
