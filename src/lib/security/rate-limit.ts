import { ApiError } from "@/lib/auth/api";

type Bucket = { count: number; resetsAt: number };
const buckets = new Map<string, Bucket>();

export function enforceMutationRateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetsAt <= now) {
    buckets.set(key, { count: 1, resetsAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new ApiError(429, "Terlalu banyak perubahan. Coba lagi sebentar.");
  current.count += 1;
}
