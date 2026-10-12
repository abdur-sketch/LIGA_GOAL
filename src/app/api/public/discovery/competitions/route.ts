import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { searchPublicCompetitions } from "@/modules/phase16/service";

export async function GET(request: NextRequest) {
  try {
    await enforceMutationRateLimit(rateLimitKey(["public-discovery", trustedClientAddress(request)]), 60, 60_000);
    const query = Object.fromEntries(request.nextUrl.searchParams.entries());
    const result = await searchPublicCompetitions(query);
    return NextResponse.json({ data: { ...result, items: result.items.map((item) => ({ id: item.id, name: item.name, description: item.description, status: item.status, format: item.format, startsAt: item.startsAt, endsAt: item.endsAt, slug: item.publication!.publicSlug, ageCategory: item.publication?.ageCategory, province: item.publication?.province, city: item.publication?.city, organizer: { name: item.organization.publicProfile?.displayName || item.organization.name, slug: item.organization.publicProfile?.publicSlug }, counts: item._count })) } });
  } catch (error) {
    if (error instanceof ApiError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    if (error && typeof error === "object" && "issues" in error) return NextResponse.json({ error: "Parameter pencarian tidak valid." }, { status: 422 });
    throw error;
  }
}
