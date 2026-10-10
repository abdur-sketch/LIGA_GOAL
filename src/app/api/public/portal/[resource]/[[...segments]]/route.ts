import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth/api";
import { enforceMutationRateLimit, rateLimitKey, trustedClientAddress } from "@/lib/security/rate-limit";
import { getPublicArticle, getPublicClub, getPublicCompetition, getPublicMatch, getPublicPlayer, getPublicStatistics, listNotifications, listPublicArticles, listPublicClubs, listPublicCompetitions, listPublicMatches, listPublicPlayers, markNotificationRead, setNotificationPreference, setPublicFollow } from "@/modules/phase7/service";

export const runtime = "nodejs";
type Context = { params: Promise<{ resource: string; segments?: string[] }> };

function failure(error: unknown) {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: "Permintaan tidak dapat diproses." }, { status: 409 });
  console.error("phase7-public-api-error", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { resource, segments = [] } = await context.params;
    await enforceMutationRateLimit(rateLimitKey(["public", trustedClientAddress(request), resource]), 120);
    const q = request.nextUrl.searchParams;
    const id = segments[0];
    if (resource === "matches") return NextResponse.json(id ? { data: await getPublicMatch(id) } : await listPublicMatches({ date: q.get("date") || undefined, competitionId: q.get("competitionId") || undefined, seasonId: q.get("seasonId") || undefined, status: q.get("status") || undefined, search: q.get("search") || undefined, page: Number(q.get("page")) || 1 }));
    if (resource === "competitions") return NextResponse.json({ data: id ? await getPublicCompetition(id) : await listPublicCompetitions() });
    if (resource === "players") return NextResponse.json({ data: id ? await getPublicPlayer(id) : await listPublicPlayers(q.get("search") || "") });
    if (resource === "clubs") return NextResponse.json({ data: id ? await getPublicClub(id) : await listPublicClubs() });
    if (resource === "statistics") return NextResponse.json({ data: await getPublicStatistics(q.get("competitionId") || undefined) });
    if (resource === "articles") return NextResponse.json({ data: id ? await getPublicArticle(id) : await listPublicArticles() });
    if (resource === "notifications") {
      const organizationId = q.get("organizationId") || "";
      const anonymousKey = q.get("anonymousKey") || "";
      if (!organizationId || anonymousKey.length < 16) throw new ApiError(400, "Identitas notifikasi tidak valid.");
      return NextResponse.json({ data: await listNotifications(organizationId, anonymousKey) });
    }
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { resource, segments = [] } = await context.params;
    const body = await request.json();
    const identity = typeof body?.anonymousKey === "string" ? body.anonymousKey : trustedClientAddress(request);
    await enforceMutationRateLimit(rateLimitKey(["public-mutation", identity, resource]), 30);
    if (resource === "follows") return NextResponse.json({ data: await setPublicFollow(body) });
    if (resource === "preferences") return NextResponse.json({ data: await setNotificationPreference(body) });
    if (resource === "notifications" && segments[1] === "read") return NextResponse.json({ data: await markNotificationRead(body.organizationId, body.anonymousKey, segments[0]) });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) { return failure(error); }
}
