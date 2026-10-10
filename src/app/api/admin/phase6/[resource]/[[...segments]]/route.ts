import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import {
  actionTransfer,
  appealDiscipline,
  clearInjury,
  createAvailability,
  createDisciplinaryCase,
  createInjury,
  createManualSuspension,
  createTransfer,
  createTransferWindow,
  decideDiscipline,
  getTransfer,
  listAvailability,
  listDiscipline,
  listInjuries,
  listSuspensions,
  listTransfers,
  listTransferWindows,
  phase6Lookups,
  updateInjury,
} from "@/modules/phase6/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ resource: string; segments?: string[] }> };

function query(request: NextRequest) {
  const value = request.nextUrl.searchParams;
  const organizationId = value.get("organizationId");
  if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
  return {
    organizationId,
    search: value.get("search")?.trim().slice(0, 120) || "",
    status: value.get("status") || undefined,
    competitionId: value.get("competitionId") || undefined,
    seasonId: value.get("seasonId") || undefined,
    playerId: value.get("playerId") || undefined,
    page: Math.max(1, Number(value.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(value.get("pageSize")) || 20)),
  };
}

function failure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return NextResponse.json({ error: "Data duplikat telah tercatat." }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")
    return NextResponse.json({ error: "Data berubah bersamaan. Muat ulang dan coba lagi." }, { status: 409 });
  console.error("phase6-api-error", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]);
    const options = query(request);
    const id = segments[0];
    if (resource === "lookups") return NextResponse.json({ data: await phase6Lookups(actor, options.organizationId) });
    if (resource === "transfers") return NextResponse.json(id ? { data: await getTransfer(actor, options.organizationId, id) } : await listTransfers(actor, options));
    if (resource === "transfer-windows") return NextResponse.json(await listTransferWindows(actor, options));
    if (resource === "availability") return NextResponse.json(await listAvailability(actor, options));
    if (resource === "injuries") return NextResponse.json(await listInjuries(actor, options));
    if (resource === "discipline") return NextResponse.json(await listDiscipline(actor, options));
    if (resource === "suspensions") return NextResponse.json(await listSuspensions(actor, options));
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]);
    const options = query(request);
    const [id, action] = segments;
    await enforceMutationRateLimit(`${actor.id}:phase6:${resource}:${action || "create"}`, 30);
    const body = await request.json();
    if (resource === "transfers" && !id) return NextResponse.json({ data: await createTransfer(actor, body) }, { status: 201 });
    if (resource === "transfers" && id && action === "action") return NextResponse.json({ data: await actionTransfer(actor, options.organizationId, id, body) });
    if (resource === "transfer-windows" && !id) return NextResponse.json({ data: await createTransferWindow(actor, body) }, { status: 201 });
    if (resource === "availability" && !id) return NextResponse.json({ data: await createAvailability(actor, body) }, { status: 201 });
    if (resource === "injuries" && !id) return NextResponse.json({ data: await createInjury(actor, body) }, { status: 201 });
    if (resource === "injuries" && id && action === "progress") return NextResponse.json({ data: await updateInjury(actor, options.organizationId, id, body) });
    if (resource === "injuries" && id && action === "clearance") return NextResponse.json({ data: await clearInjury(actor, options.organizationId, id, body) });
    if (resource === "suspensions" && !id) return NextResponse.json({ data: await createManualSuspension(actor, body) }, { status: 201 });
    if (resource === "discipline" && !id) return NextResponse.json({ data: await createDisciplinaryCase(actor, body) }, { status: 201 });
    if (resource === "discipline" && id && action === "decision") return NextResponse.json({ data: await decideDiscipline(actor, options.organizationId, id, body) });
    if (resource === "discipline" && id && action === "appeal") return NextResponse.json({ data: await appealDiscipline(actor, options.organizationId, id, body) }, { status: 201 });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
