import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, authorizeOrganization, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import { readPrivateDocument, savePrivateDocument } from "@/lib/storage/private-documents";
import { documentMetaSchema } from "@/modules/phase2/validation";
import { addRosterEntry, archivePlayer, createPlayer, createRegistration, getDocumentForDownload, getEligibilityRules, getPlayer, getRegistration, listPlayers, listRegistrations, listRoster, lookups, registerDocument, releaseRosterEntry, saveEligibilityRules, transitionRegistration, updatePlayer, verifyDocument } from "@/modules/phase2/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ resource: string; segments?: string[] }> };

function query(request: NextRequest) {
  const value = request.nextUrl.searchParams; const organizationId = value.get("organizationId");
  if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
  return { organizationId, search: value.get("search")?.trim().slice(0, 120) || "", status: value.get("status") || undefined, page: Math.max(1, Number(value.get("page")) || 1), pageSize: Math.min(100, Math.max(1, Number(value.get("pageSize")) || 10)), seasonId: value.get("seasonId") || undefined, clubId: value.get("clubId") || undefined };
}
function errorResponse(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Data tersebut sudah terdaftar." }, { status: 409 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "Data berubah bersamaan. Silakan ulangi tindakan." }, { status: 409 });
  console.error("phase2-api-error", error); return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]); const options = query(request); const id = segments[0];
    if (resource === "players") return NextResponse.json(id ? { data: await getPlayer(actor, options.organizationId, id) } : await listPlayers(actor, options));
    if (resource === "registrations") return NextResponse.json(id ? { data: await getRegistration(actor, options.organizationId, id) } : await listRegistrations(actor, options));
    if (resource === "squads") return NextResponse.json(await listRoster(actor, options));
    if (resource === "lookups") return NextResponse.json({ data: await lookups(actor, options.organizationId) });
    if (resource === "rules" && id) return NextResponse.json({ data: await getEligibilityRules(actor, options.organizationId, id) });
    if (resource === "documents" && id && segments[1] === "download") {
      const document = await getDocumentForDownload(actor, options.organizationId, id); const bytes = await readPrivateDocument(document.storageKey);
      return new NextResponse(bytes, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.originalName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
    }
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]); const options = query(request); enforceMutationRateLimit(`${actor.id}:phase2:${resource}`, 20); const id = segments[0]; const action = segments[1];
    if (resource === "documents" && !id) {
      await authorizeOrganization(actor, options.organizationId, "player_document.upload"); const form = await request.formData(); const file = form.get("file"); if (!(file instanceof File)) throw new ApiError(422, "File dokumen wajib disertakan.");
      const input = documentMetaSchema.parse({ playerId: form.get("playerId"), registrationId: form.get("registrationId") || null, type: form.get("type"), label: form.get("label") || null, replacedDocumentId: form.get("replacedDocumentId") || null });
      const stored = await savePrivateDocument(file, options.organizationId); return NextResponse.json({ data: await registerDocument(actor, options.organizationId, input, stored) }, { status: 201 });
    }
    const body = await request.json();
    if (resource === "players" && !id) return NextResponse.json({ data: await createPlayer(actor, options.organizationId, body) }, { status: 201 });
    if (resource === "registrations" && !id) return NextResponse.json({ data: await createRegistration(actor, options.organizationId, body) }, { status: 201 });
    if (resource === "registrations" && id && action && ["submit", "verify", "approve", "reject"].includes(action)) return NextResponse.json({ data: await transitionRegistration(actor, options.organizationId, id, action as "submit" | "verify" | "approve" | "reject", body) });
    if (resource === "squads" && !id) return NextResponse.json({ data: await addRosterEntry(actor, options.organizationId, body) }, { status: 201 });
    if (resource === "documents" && id && action === "verify") return NextResponse.json({ data: await verifyDocument(actor, options.organizationId, id, body) });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest, context: Context) {
  try { const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]); const options = query(request); if (!segments[0]) throw new ApiError(404, "Endpoint tidak ditemukan."); enforceMutationRateLimit(`${actor.id}:phase2:${resource}:update`, 20); if (resource === "players") return NextResponse.json({ data: await updatePlayer(actor, options.organizationId, segments[0], await request.json()) }); if (resource === "rules") return NextResponse.json({ data: await saveEligibilityRules(actor, options.organizationId, segments[0], await request.json()) }); throw new ApiError(404, "Endpoint tidak ditemukan."); } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try { const [{ resource, segments = [] }, actor] = await Promise.all([context.params, getApiActor()]); const options = query(request); if (!segments[0]) throw new ApiError(400, "ID wajib diisi."); enforceMutationRateLimit(`${actor.id}:phase2:${resource}:delete`, 10); if (resource === "players") return NextResponse.json({ data: await archivePlayer(actor, options.organizationId, segments[0]) }); if (resource === "squads") return NextResponse.json({ data: await releaseRosterEntry(actor, options.organizationId, segments[0]) }); throw new ApiError(404, "Endpoint tidak ditemukan."); } catch (error) { return errorResponse(error); }
}
