import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { captureError } from "@/lib/observability/logger";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { deletePrivateDocument, savePrivateDocument } from "@/lib/storage/private-documents";
import { publicRegistrationStatus, resolvePublicRegistrationTarget, submitPublicRegistration } from "@/modules/phase21/service";

function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data pendaftaran tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  captureError("phase21_public_registration_failed", error);
  return NextResponse.json({ error: "Pendaftaran belum dapat diproses. Silakan coba lagi." }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await enforceMutationRateLimit(rateLimitKey(["registration-status", trustedClientAddress(request)]), 30, 15 * 60_000);
    return NextResponse.json({ data: await publicRegistrationStatus({ registrationNumber: request.nextUrl.searchParams.get("number"), token: request.nextUrl.searchParams.get("token") }) });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  const stored: Array<{ storageKey: string }> = [];
  try {
    const address = trustedClientAddress(request);
    await enforceMutationRateLimit(rateLimitKey(["public-registration", address]), 10, 15 * 60_000);
    const contentType = request.headers.get("content-type") || "";
    let input: Record<string, unknown>;
    let files: File[] = [];
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const raw = form.get("data");
      if (typeof raw !== "string") throw new ApiError(422, "Data pendaftaran wajib diisi.");
      try { input = JSON.parse(raw) as Record<string, unknown>; } catch { throw new ApiError(422, "Format data pendaftaran tidak valid."); }
      files = form.getAll("documents").filter((item): item is File => item instanceof File && item.size > 0);
    } else {
      input = await request.json() as Record<string, unknown>;
    }
    const publicSlug = typeof input.publicSlug === "string" ? input.publicSlug : "";
    const target = await resolvePublicRegistrationTarget(publicSlug);
    for (const file of files.slice(0, 10)) stored.push(await savePrivateDocument(file, target.organizationId));
    const documents = stored.map((item, index) => ({ ...item, originalName: files[index].name, mimeType: files[index].type, sizeBytes: files[index].size }));
    const result = await submitPublicRegistration({ ...input, documents });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    await Promise.allSettled(stored.map((item) => deletePrivateDocument(item.storageKey)));
    return failure(error);
  }
}
