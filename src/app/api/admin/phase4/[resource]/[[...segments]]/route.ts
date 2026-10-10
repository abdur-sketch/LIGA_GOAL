import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor, authorizeOrganization } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  confirmLineup,
  correctEvent,
  createEvent,
  eligiblePlayers,
  getMatchSnapshot,
  listMatches,
  realtimeMessages,
  requestOfficialCorrection,
  reviewMatch,
  reviewOfficialCorrection,
  saveLineup,
  transitionMatch,
} from "@/modules/phase4/service";

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
    pageSize: Math.min(100, Math.max(1, Number(params.get("pageSize")) || 20)),
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
      { error: "Permintaan duplikat telah diproses." },
      { status: 409 },
    );
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
    return NextResponse.json(
      { error: "Data berubah bersamaan. Muat ulang dan coba lagi." },
      { status: 409 },
    );
  console.error("phase4-api-error", error);
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
    const [id, action] = segments;
    if (resource !== "matches")
      throw new ApiError(404, "Endpoint tidak ditemukan.");
    if (!id) return NextResponse.json(await listMatches(actor, options));
    if (action === "eligible") {
      const teamId = request.nextUrl.searchParams.get("teamId");
      if (!teamId) throw new ApiError(400, "teamId wajib diisi.");
      return NextResponse.json({
        data: await eligiblePlayers(actor, options.organizationId, id, teamId),
      });
    }
    if (action === "realtime") {
      await authorizeOrganization(actor, options.organizationId, "match.view");
      const afterValue = request.nextUrl.searchParams.get("after");
      return NextResponse.json({
        data: await realtimeMessages(
          id,
          options.organizationId,
          afterValue ? BigInt(afterValue) : undefined,
        ),
      });
    }
    return NextResponse.json({
      data: await getMatchSnapshot(actor, options.organizationId, id),
    });
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
    const [id, action, detail] = segments;
    if (!id) throw new ApiError(400, "ID wajib diisi.");
    await enforceMutationRateLimit(
      `${actor.id}:phase4:${resource}:${action || "create"}`,
      60,
    );
    const body = await request.json();
    if (resource === "matches" && action === "transition")
      return NextResponse.json({
        data: await transitionMatch(actor, options.organizationId, id, body),
      });
    if (resource === "matches" && action === "lineups" && detail === "confirm")
      return NextResponse.json({
        data: await confirmLineup(
          actor,
          options.organizationId,
          id,
          String(body.teamId || ""),
        ),
      });
    if (resource === "matches" && action === "events")
      return NextResponse.json(
        { data: await createEvent(actor, options.organizationId, id, body) },
        { status: 201 },
      );
    if (resource === "matches" && action === "review")
      return NextResponse.json({
        data: await reviewMatch(actor, options.organizationId, id, body),
      });
    if (resource === "matches" && action === "corrections")
      return NextResponse.json(
        {
          data: await requestOfficialCorrection(
            actor,
            options.organizationId,
            id,
            body,
          ),
        },
        { status: 201 },
      );
    if (resource === "corrections" && action === "review")
      return NextResponse.json({
        data: await reviewOfficialCorrection(
          actor,
          options.organizationId,
          id,
          body,
        ),
      });
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
    const [id, action, detail] = segments;
    if (!id) throw new ApiError(400, "ID wajib diisi.");
    await enforceMutationRateLimit(`${actor.id}:phase4:${resource}:update`, 40);
    const body = await request.json();
    if (resource === "matches" && action === "lineups")
      return NextResponse.json({
        data: await saveLineup(actor, options.organizationId, id, body),
      });
    if (resource === "matches" && action === "events" && detail)
      return NextResponse.json({
        data: await correctEvent(
          actor,
          options.organizationId,
          id,
          detail,
          body,
        ),
      });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
