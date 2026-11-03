import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { captureError } from "@/lib/observability/logger";
import { withRuntimeDatabaseRoute } from "@/lib/runtime-route";
import { enforceMutationRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { readPrivateDocument } from "@/lib/storage/private-documents";
import { getPublicRegistrationDocument } from "@/modules/phase21/service";

async function GETHandler(request: NextRequest, context: { params: Promise<{ registrationId: string; documentIndex: string }> }) {
  try {
    const actor = await getApiActor();
    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!organizationId) throw new ApiError(422, "organizationId wajib diisi.");
    const { registrationId, documentIndex: rawIndex } = await context.params;
    const documentIndex = Number(rawIndex);
    if (!Number.isInteger(documentIndex) || documentIndex < 0 || documentIndex > 9) throw new ApiError(404, "Dokumen pendaftaran tidak ditemukan.");
    await enforceMutationRateLimit(rateLimitKey(["phase27-registration-document", actor.id, organizationId]), 60, 60_000);
    const document = await getPublicRegistrationDocument(actor, organizationId, registrationId, documentIndex);
    const bytes = await readPrivateDocument(document.storageKey, organizationId);
    const asciiName = document.originalName.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 120) || "document";
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "content-type": document.mimeType,
      "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    } });
  } catch (error) {
    if (!(error instanceof ApiError)) captureError("phase27_registration_document_failed", error);
    return NextResponse.json({ error: error instanceof ApiError ? error.message : "Dokumen belum dapat diunduh." }, { status: error instanceof ApiError ? error.status : 500, headers: { "cache-control": "no-store" } });
  }
}

export const GET = withRuntimeDatabaseRoute(GETHandler);
