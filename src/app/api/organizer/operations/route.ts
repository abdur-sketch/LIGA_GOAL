import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { captureError } from "@/lib/observability/logger";
import { withRuntimeDatabaseRoute } from "@/lib/runtime-route";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { assignJudge, configurePublicRegistration, getOrganizerOperations, getPublicRegistrationReviewDetail, reviewPublicRegistration, revokeJudgeAssignment, transitionResultWorkflow } from "@/modules/phase21/service";
import { phase21OrganizerActionSchema } from "@/modules/phase21/validation";

function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data operasi tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Operasi yang sama sudah diproses." }, { status: 409 });
  captureError("phase21_organizer_operations_failed", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

async function GETHandler(request: NextRequest) {
  try {
    const actor = await getApiActor();
    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(422, "organizationId wajib diisi.");
    const registrationId = request.nextUrl.searchParams.get("registrationId");
    if (registrationId) {
      await enforceMutationRateLimit(rateLimitKey(["phase21-registration-detail", actor.id, organizationId]), 60, 60_000);
      return NextResponse.json({ data: await getPublicRegistrationReviewDetail(actor, organizationId, registrationId) });
    }
    return NextResponse.json({ data: await getOrganizerOperations(actor, organizationId) });
  } catch (error) { return failure(error); }
}

async function POSTHandler(request: NextRequest) {
  try {
    const actor = await getApiActor();
    const input = phase21OrganizerActionSchema.parse(await request.json());
    const organizationId = input.data.organizationId;
    await enforceMutationRateLimit(rateLimitKey(["phase21-operations", actor.id, organizationId]), 40, 60_000);
    if (input.action === "configure-registration") return NextResponse.json({ data: await configurePublicRegistration(actor, input.data) });
    if (input.action === "assign-judge") return NextResponse.json({ data: await assignJudge(actor, input.data) }, { status: 201 });
    if (input.action === "revoke-judge") return NextResponse.json({ data: await revokeJudgeAssignment(actor, organizationId, input.data.assignmentId, input.data.reason) });
    if (input.action === "review-registration") return NextResponse.json({ data: await reviewPublicRegistration(actor, input.data) });
    return NextResponse.json({ data: await transitionResultWorkflow(actor, input.data) });
  } catch (error) { return failure(error); }
}

export const GET = withRuntimeDatabaseRoute(GETHandler);
export const POST = withRuntimeDatabaseRoute(POSTHandler);
