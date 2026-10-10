import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { publicAvailability } from "@/modules/phase6/service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const organizationId = params.get("organizationId");
    const playerId = params.get("playerId");
    if (!organizationId || !playerId)
      throw new ApiError(400, "organizationId dan playerId wajib diisi.");
    const at = params.get("at");
    const date = at ? new Date(at) : new Date();
    if (Number.isNaN(date.getTime())) throw new ApiError(422, "Tanggal tidak valid.");
    return NextResponse.json({ data: await publicAvailability(organizationId, playerId, date) });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("public-availability-api-error", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
  }
}
