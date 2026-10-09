import { NextResponse } from "next/server";
import { ApiError } from "@/lib/auth/api";
import {
  publicMatchSnapshot,
  realtimeMessages,
} from "@/modules/phase4/service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    if (url.searchParams.has("realtime")) {
      const after = url.searchParams.get("after");
      return NextResponse.json({
        data: await realtimeMessages(
          id,
          undefined,
          after ? BigInt(after) : undefined,
        ),
      });
    }
    return NextResponse.json({ data: await publicMatchSnapshot(id) });
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
