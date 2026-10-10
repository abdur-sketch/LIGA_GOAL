import { z } from "zod";

const identifier = z.string().trim().min(1).max(64);
const safeText = (max: number) => z.string().trim().min(1).max(max).refine((value) => !/<\/?(?:script|iframe|object|embed|style|form)|on\w+\s*=|javascript:/i.test(value), "Konten HTML atau script tidak diizinkan.");

export const articleInput = z.object({
  organizationId: identifier,
  competitionId: identifier.nullish(),
  title: safeText(180),
  slug: z.string().trim().min(3).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug harus berupa huruf kecil, angka, dan tanda hubung."),
  excerpt: safeText(320).nullish(),
  body: safeText(40_000),
  category: safeText(60).default("Berita"),
  coverUrl: z.string().url().max(500).nullish(),
  scheduledAt: z.coerce.date().nullish(),
});

export const articleActionInput = z.object({
  organizationId: identifier,
  action: z.enum(["publish", "schedule", "archive", "draft"]),
  scheduledAt: z.coerce.date().nullish(),
});

export const followInput = z.object({
  organizationId: identifier,
  anonymousKey: z.string().trim().min(16).max(128),
  type: z.enum(["COMPETITION", "CLUB", "MATCH"]),
  targetId: identifier,
  follow: z.boolean().default(true),
});

export const preferenceInput = z.object({
  organizationId: identifier,
  anonymousKey: z.string().trim().min(16).max(128),
  enabled: z.boolean(),
  eventTypes: z.array(z.enum(["MATCH_STARTING_SOON", "MATCH_STARTED", "GOAL_SCORED", "HALF_TIME", "FULL_TIME", "OFFICIAL_RESULT", "SCHEDULE_CHANGED", "MATCH_POSTPONED", "MATCH_CANCELLED", "COMPETITION_ANNOUNCEMENT"])).max(10),
});

export const notificationInput = z.object({
  organizationId: identifier,
  competitionId: identifier.nullish(),
  clubId: identifier.nullish(),
  matchId: identifier.nullish(),
  type: z.enum(["MATCH_STARTING_SOON", "MATCH_STARTED", "GOAL_SCORED", "HALF_TIME", "FULL_TIME", "OFFICIAL_RESULT", "SCHEDULE_CHANGED", "MATCH_POSTPONED", "MATCH_CANCELLED", "COMPETITION_ANNOUNCEMENT"]),
  title: safeText(140),
  body: safeText(500),
  sourceKey: z.string().trim().min(3).max(180),
});

export function sanitizePlainText(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/javascript:/gi, "").trim();
}
