import { z } from "zod";
const id = z.string().cuid();
const nullableId = id.optional().nullable();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);
const date = z
  .string()
  .datetime()
  .or(z.string().date())
  .transform((value) => new Date(value));

export const formatConfigSchema = z.object({
  numberOfGroups: z.coerce.number().int().min(1).max(32).default(1),
  qualifiersPerGroup: z.coerce.number().int().min(1).max(16).default(1),
  rounds: z.coerce.number().int().min(1).max(2).default(1),
  homeAway: z.boolean().default(false),
  drawMethod: z.enum(["MANUAL", "RANDOM", "SEEDED"]).default("RANDOM"),
  tieBreakers: z
    .array(
      z.enum([
        "points",
        "goal_difference",
        "goals_for",
        "head_to_head",
        "fair_play",
      ]),
    )
    .min(1)
    .default(["points", "goal_difference", "goals_for"]),
  knockoutLegs: z.coerce.number().int().min(1).max(2).default(1),
  extraTime: z.boolean().default(true),
  penaltyShootout: z.boolean().default(true),
  thirdPlace: z.boolean().default(false),
  minimumRestHours: z.coerce.number().int().min(0).max(336).default(24),
  matchDurationMinutes: z.coerce.number().int().min(30).max(300).default(120),
  timezone: z.string().trim().min(3).max(80).default("Asia/Jakarta"),
});
export const stageSchema = z.object({
  seasonId: id,
  name: z.string().trim().min(2).max(100),
  sortOrder: z.coerce.number().int().min(1).max(100),
  type: z.enum(["ROUND_ROBIN", "GROUP", "KNOCKOUT"]),
  format: z.enum([
    "SINGLE_ROUND_ROBIN",
    "DOUBLE_ROUND_ROBIN",
    "GROUP_STAGE",
    "SINGLE_ELIMINATION",
    "GROUP_AND_KNOCKOUT",
  ]),
  settings: z.record(z.unknown()).default({}),
});
export const groupSchema = z.object({
  stageId: id,
  name: z.string().trim().min(1).max(80),
  confirmPublishedChange: z.boolean().default(false),
});
export const membershipSchema = z.object({
  clubId: id,
  seed: z.coerce.number().int().min(1).max(999).optional().nullable(),
  confirmPublishedChange: z.boolean().default(false),
});
export const automaticDrawSchema = z.object({
  clubIds: z.array(id).min(2).max(128),
  seeded: z.boolean().default(false),
  confirmPublishedChange: z.boolean().default(false),
});
export const generationSchema = z.object({
  competitionId: id,
  seasonId: id,
  stageId: id,
  idempotencyKey: z.string().trim().min(8).max(120),
  format: z.enum([
    "SINGLE_ROUND_ROBIN",
    "DOUBLE_ROUND_ROBIN",
    "GROUP_STAGE",
    "SINGLE_ELIMINATION",
    "GROUP_AND_KNOCKOUT",
  ]),
  drawMethod: z.enum(["MANUAL", "RANDOM", "SEEDED"]).default("RANDOM"),
  clubIds: z.array(id).max(128).optional(),
  kickoffStart: date.optional().nullable(),
  daysBetweenRounds: z.coerce.number().int().min(0).max(60).default(7),
  venueIds: z.array(id).max(64).default([]),
  refereeIds: z.array(id).max(64).default([]),
  config: formatConfigSchema,
});
export const publicationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120),
});
export const manualFixtureSchema = z.object({
  competitionId: id,
  seasonId: id,
  stageId: id,
  groupId: nullableId,
  homeClubId: id,
  awayClubId: id,
  venueId: nullableId,
  refereeId: nullableId,
  kickoffAt: date.optional().nullable(),
  timezone: z.string().trim().min(3).max(80).default("Asia/Jakarta"),
});
export const fixtureUpdateSchema = z.object({
  venueId: nullableId,
  refereeId: nullableId,
  kickoffAt: date.optional().nullable(),
  timezone: z.string().trim().min(3).max(80).optional(),
  reason: optionalText(1000),
});
export const cancelSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
});
export const bracketSchema = z.object({
  competitionId: id,
  stageId: id,
  clubIds: z.array(id).min(2).max(32),
  seeded: z.boolean().default(false),
  legs: z.coerce.number().int().min(1).max(2).default(1),
  thirdPlace: z.boolean().default(false),
});
