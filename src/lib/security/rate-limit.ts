import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";

type RateRow = { count: number; expiresAt: Date };

function opaqueKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function trustedClientAddress(request: NextRequest) {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS || "0", 10);
  if (hops > 0) {
    const chain = request.headers.get("x-forwarded-for")?.split(",").map((item) => item.trim()).filter(Boolean) || [];
    const index = chain.length - hops;
    if (index >= 0 && chain[index]) return chain[index];
  }
  return request.headers.get("x-real-ip") || "direct-client";
}

export function rateLimitKey(parts: Array<string | null | undefined>) {
  return opaqueKey(parts.filter(Boolean).join(":"));
}

export async function enforceMutationRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = new Date();
  const expiresAt = new Date(now.valueOf() + windowMs);
  const bucket = opaqueKey(key);
  const rows = await db.$queryRaw<RateRow[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt", "updatedAt")
    VALUES (${bucket}, 1, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `);
  const row = rows[0];
  if (!row || row.count > limit) {
    const retryAfter = row ? Math.max(1, Math.ceil((row.expiresAt.valueOf() - now.valueOf()) / 1000)) : 60;
    throw new ApiError(429, "Terlalu banyak permintaan. Coba lagi sebentar.", { retryAfter });
  }
  return { remaining: Math.max(0, limit - row.count), resetsAt: row.expiresAt };
}

export async function pruneExpiredRateLimits(before = new Date(Date.now() - 86_400_000)) {
  return db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: before } } });
}

export async function clearRateLimit(key: string) {
  await db.rateLimitBucket.deleteMany({ where: { key: opaqueKey(key) } });
}
