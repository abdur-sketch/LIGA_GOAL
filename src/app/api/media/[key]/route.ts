import { NextResponse } from "next/server";
import { ApiError } from "@/lib/auth/api";
import { loadImage, mimeForKey } from "@/lib/storage/images";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try { const { key } = await params; return new NextResponse(await loadImage(key), { headers: { "Content-Type": mimeForKey(key), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof ApiError ? error.message : "Gambar tidak ditemukan." }, { status: error instanceof ApiError ? error.status : 500 }); }
}
