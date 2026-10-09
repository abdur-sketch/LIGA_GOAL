import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { publicStatistics } from "@/modules/phase5/service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const data = await publicStatistics({
      organizationId: params.get("organizationId") || "",
      competitionId: params.get("competitionId") || "",
      seasonId: params.get("seasonId") || "",
      stageId: params.get("stageId") || undefined,
      groupId: params.get("groupId") || undefined,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return NextResponse.json({ error: "Parameter tidak valid." }, { status: 422 });
    console.error("public-statistics-api-error", error);
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
  }
}
