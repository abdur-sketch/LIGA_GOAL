import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  automaticGroupDraw,
  assignGroupClub,
  cancelFixture,
  createBracket,
  createGroup,
  createManualFixture,
  createStage,
  generateFixturePreview,
  getFixture,
  getFormatRules,
  getGeneration,
  listFixtures,
  listGenerations,
  listGroups,
  phase3Lookups,
  postponeFixture,
  publishManualFixture,
  publishGeneration,
  readBracket,
  removeGroupClub,
  renameGroup,
  rescheduleFixture,
  saveFormatRules,
  updateFixture,
  updateFixtureDraft,
  validateGeneration,
} from "@/modules/phase3/service";

type Context = { params: Promise<{ resource: string; segments?: string[] }> };
function query(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const organizationId = params.get("organizationId");
  if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
  return {
    organizationId,
    search: params.get("search")?.trim().slice(0, 120) || "",
    status: params.get("status") || undefined,
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10)),
    seasonId: params.get("seasonId") || undefined,
    competitionId: params.get("competitionId") || undefined,
    stageId: params.get("stageId") || undefined,
    groupId: params.get("groupId") || undefined,
  };
}
function failure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Data tidak valid.", details: error.flatten().fieldErrors },
      { status: 422 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return NextResponse.json(
      { error: "Data unik tersebut sudah digunakan." },
      { status: 409 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
    return NextResponse.json(
      { error: "Data berubah bersamaan. Silakan ulangi tindakan." },
      { status: 409 },
    );
  console.error("phase3-api-error", error);
  return NextResponse.json(
    { error: "Terjadi kesalahan internal." },
    { status: 500 },
  );
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([
      context.params,
      getApiActor(),
    ]);
    const options = query(request);
    const id = segments[0];
    if (resource === "lookups")
      return NextResponse.json({
        data: await phase3Lookups(actor, options.organizationId),
      });
    if (resource === "formats" && id)
      return NextResponse.json({
        data: await getFormatRules(actor, options.organizationId, id),
      });
    if (resource === "groups")
      return NextResponse.json(await listGroups(actor, options));
    if (resource === "generations")
      return NextResponse.json(
        id
          ? { data: await getGeneration(actor, options.organizationId, id) }
          : await listGenerations(actor, options),
      );
    if (resource === "fixtures")
      return NextResponse.json(
        id
          ? { data: await getFixture(actor, options.organizationId, id) }
          : await listFixtures(actor, options),
      );
    if (resource === "schedule")
      return NextResponse.json(
        await listFixtures(actor, options, "schedule.view"),
      );
    if (resource === "brackets" && id)
      return NextResponse.json({
        data: await readBracket(actor, options.organizationId, id),
      });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([
      context.params,
      getApiActor(),
    ]);
    const options = query(request);
    const [id, action] = segments;
    enforceMutationRateLimit(`${actor.id}:phase3:${resource}`, 30);
    const body = await request.json();
    if (resource === "stages" && !id)
      return NextResponse.json(
        { data: await createStage(actor, options.organizationId, body) },
        { status: 201 },
      );
    if (resource === "groups" && !id)
      return NextResponse.json(
        { data: await createGroup(actor, options.organizationId, body) },
        { status: 201 },
      );
    if (resource === "groups" && id && action === "members")
      return NextResponse.json(
        {
          data: await assignGroupClub(actor, options.organizationId, id, body),
        },
        { status: 201 },
      );
    if (resource === "groups" && id && action === "draw")
      return NextResponse.json({
        data: await automaticGroupDraw(actor, options.organizationId, id, body),
      });
    if (resource === "generations" && !id)
      return NextResponse.json(
        {
          data: await generateFixturePreview(
            actor,
            options.organizationId,
            body,
          ),
        },
        { status: 201 },
      );
    if (resource === "generations" && id && action === "validate")
      return NextResponse.json({
        data: await validateGeneration(actor, options.organizationId, id),
      });
    if (resource === "generations" && id && action === "publish")
      return NextResponse.json({
        data: await publishGeneration(actor, options.organizationId, id, body),
      });
    if (resource === "fixtures" && !id)
      return NextResponse.json(
        {
          data: await createManualFixture(actor, options.organizationId, body),
        },
        { status: 201 },
      );
    if (resource === "fixtures" && id && action === "reschedule")
      return NextResponse.json({
        data: await rescheduleFixture(actor, options.organizationId, id, body),
      });
    if (resource === "fixtures" && id && action === "postpone")
      return NextResponse.json({
        data: await postponeFixture(actor, options.organizationId, id, body),
      });
    if (resource === "fixtures" && id && action === "publish")
      return NextResponse.json({
        data: await publishManualFixture(actor, options.organizationId, id),
      });
    if (resource === "fixtures" && id && action === "cancel")
      return NextResponse.json({
        data: await cancelFixture(actor, options.organizationId, id, body),
      });
    if (resource === "brackets" && !id)
      return NextResponse.json(
        { data: await createBracket(actor, options.organizationId, body) },
        { status: 201 },
      );
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([
      context.params,
      getApiActor(),
    ]);
    const options = query(request);
    const id = segments[0];
    if (!id) throw new ApiError(400, "ID wajib diisi.");
    enforceMutationRateLimit(`${actor.id}:phase3:${resource}:update`, 20);
    const body = await request.json();
    if (resource === "formats")
      return NextResponse.json({
        data: await saveFormatRules(actor, options.organizationId, id, body),
      });
    if (resource === "groups")
      return NextResponse.json({
        data: await renameGroup(actor, options.organizationId, id, body),
      });
    if (resource === "fixtures")
      return NextResponse.json({
        data: await updateFixture(actor, options.organizationId, id, body),
      });
    if (resource === "drafts")
      return NextResponse.json({
        data: await updateFixtureDraft(actor, options.organizationId, id, body),
      });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([
      context.params,
      getApiActor(),
    ]);
    const options = query(request);
    const id = segments[0];
    if (resource !== "memberships" || !id)
      throw new ApiError(404, "Endpoint tidak ditemukan.");
    enforceMutationRateLimit(`${actor.id}:phase3:membership:delete`, 20);
    return NextResponse.json({
      data: await removeGroupClub(
        actor,
        options.organizationId,
        id,
        request.nextUrl.searchParams.get("confirmPublishedChange") === "true",
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
