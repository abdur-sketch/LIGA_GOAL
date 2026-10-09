import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { hasPermission, type PermissionKey } from "@/lib/auth/permissions";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import { saveImage } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await getApiActor();
    enforceMutationRateLimit(`${actor.id}:upload`, 12);
    const organizationId = request.nextUrl.searchParams.get("organizationId");
    if (!actor.isPlatformAdmin) {
      if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
      const permissions: PermissionKey[] = ["organization.update", "competition.update", "club.update", "venue.update", "official.update", "player.update", "player_document.upload"];
      const allowed = (await Promise.all(permissions.map((permission) => hasPermission(actor.id, organizationId, permission)))).some(Boolean);
      if (!allowed) throw new ApiError(403, "Tidak memiliki izin unggah pada organisasi ini.");
    }
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) throw new ApiError(422, "File gambar wajib disertakan.");
    return NextResponse.json({ data: await saveImage(file) }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("upload-error", error); return NextResponse.json({ error: "Unggah gagal." }, { status: 500 });
  }
}
