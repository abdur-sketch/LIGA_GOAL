import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import { archiveResource, createOrganization, createResource, listOrganizations, listResource, updateResource } from "@/modules/phase1/service";
import { schemas, type ResourceName } from "@/modules/phase1/validation";

const resources = new Set(Object.keys(schemas));

function parseResource(value: string): ResourceName {
  if (!resources.has(value)) throw new ApiError(404, "Endpoint tidak ditemukan.");
  return value as ResourceName;
}

function queryFrom(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize")) || 10));
  return { organizationId: params.get("organizationId") || undefined, search: params.get("search")?.trim().slice(0, 120) || "", status: params.get("status") || undefined, page, pageSize };
}

async function context(ctx: { params: Promise<{ resource: string; segments?: string[] }> }) {
  const params = await ctx.params;
  return { resource: parseResource(params.resource), id: params.segments?.[0] };
}

function handleError(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Data unik tersebut sudah digunakan." }, { status: 409 });
  console.error("admin-api-error", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ resource: string; segments?: string[] }> }) {
  try {
    const [{ resource }, actor] = await Promise.all([context(ctx), getApiActor()]);
    const query = queryFrom(request);
    return NextResponse.json(resource === "organizations" ? await listOrganizations(actor, query) : await listResource(resource, actor, query));
  } catch (error) { return handleError(error); }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ resource: string; segments?: string[] }> }) {
  try {
    const [{ resource }, actor] = await Promise.all([context(ctx), getApiActor()]);
    enforceMutationRateLimit(`${actor.id}:${resource}:create`);
    const input = await request.json();
    const organizationId = request.nextUrl.searchParams.get("organizationId");
    const data = resource === "organizations" ? await createOrganization(actor, input) : organizationId ? await createResource(resource, actor, organizationId, input) : (() => { throw new ApiError(400, "organizationId wajib diisi."); })();
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return handleError(error); }
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ resource: string; segments?: string[] }> }) {
  try {
    const [{ resource, id }, actor] = await Promise.all([context(ctx), getApiActor()]);
    if (!id) throw new ApiError(400, "ID wajib diisi.");
    enforceMutationRateLimit(`${actor.id}:${resource}:update`);
    const organizationId = resource === "organizations" ? id : request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
    return NextResponse.json({ data: await updateResource(resource, id, actor, organizationId, await request.json()) });
  } catch (error) { return handleError(error); }
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ resource: string; segments?: string[] }> }) {
  try {
    const [{ resource, id }, actor] = await Promise.all([context(ctx), getApiActor()]);
    if (!id) throw new ApiError(400, "ID wajib diisi.");
    enforceMutationRateLimit(`${actor.id}:${resource}:delete`, 10);
    const organizationId = resource === "organizations" ? id : request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
    return NextResponse.json({ data: await archiveResource(resource, id, actor, organizationId) });
  } catch (error) { return handleError(error); }
}
