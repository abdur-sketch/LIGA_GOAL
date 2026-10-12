import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/auth/api";
import {
  enforceMutationRateLimit,
  rateLimitKey,
  trustedClientAddress,
} from "@/lib/security/rate-limit";
import {
  publicMatchSnapshot,
  publicRealtimeMessages,
} from "@/modules/phase4/service";
import { withPublicDatabase } from "@/lib/tenant-db";

async function GETHandler(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await enforceMutationRateLimit(
      rateLimitKey(["match-poll", trustedClientAddress(request), id]),
      120,
    );
    const url = new URL(request.url);
    if (url.searchParams.has("realtime")) {
      const after = url.searchParams.get("after");
      const started = performance.now();
      const response = NextResponse.json({
        data: await publicRealtimeMessages(
          id,
          after ? BigInt(after) : BigInt(0),
        ),
      });
      response.headers.set(
        "server-timing",
        `database;dur=${(performance.now() - started).toFixed(2)}`,
      );
      return response;
    }
    return NextResponse.json({
      data: await withPublicDatabase(() => publicMatchSnapshot(id)),
    });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "Terjadi kesalahan internal." },
      { status: 500 },
    );
  }
}
export const GET = GETHandler;
