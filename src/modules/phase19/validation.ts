import { z } from "zod";

const id = z.string().trim().min(1).max(64);
const slug = z.string().trim().toLowerCase().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const optionalText = (max: number) => z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(max).optional());
const optionalDate = z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.date().optional());

export const genericCompetitionSchema = z.object({
  organizationId: id,
  templateCode: z.enum(["football", "lct", "school", "arts", "religious", "festival", "esports", "custom"]),
  name: z.string().trim().min(3).max(160),
  slug,
  description: optionalText(4_000),
  category: optionalText(100),
  location: optionalText(200),
  parentCompetitionId: z.preprocess((value) => value === "" ? undefined : value, id.optional()),
  startsAt: optionalDate,
  endsAt: optionalDate,
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{8,160}$/),
}).strict().refine((value) => !value.startsAt || !value.endsAt || value.endsAt >= value.startsAt, { path: ["endsAt"], message: "Tanggal selesai harus setelah tanggal mulai." });

export const participantSchema = z.object({
  organizationId: id,
  type: z.enum(["INDIVIDUAL", "TEAM", "INSTITUTION"]),
  name: z.string().trim().min(2).max(160),
  slug,
  displayName: optionalText(160),
  institution: optionalText(160),
  contactEmail: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().toLowerCase().email().max(254).optional()),
  contactPhone: optionalText(40),
}).strict();

export const entrySchema = z.object({
  organizationId: id,
  competitionId: id,
  participantId: id,
  seasonId: z.preprocess((value) => value === "" ? undefined : value, id.optional()),
  entryName: optionalText(160),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{8,160}$/),
}).strict();

export const sessionSchema = z.object({
  organizationId: id,
  competitionId: id,
  name: z.string().trim().min(2).max(160),
  sequence: z.coerce.number().int().min(1).max(10_000),
  startsAt: optionalDate,
  endsAt: optionalDate,
  entryIds: z.array(id).max(128).default([]),
}).strict().refine((value) => !value.startsAt || !value.endsAt || value.endsAt >= value.startsAt, { path: ["endsAt"], message: "Waktu selesai harus setelah waktu mulai." });

export const criterionSchema = z.object({
  organizationId: id,
  competitionId: id,
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,40}$/),
  weight: z.coerce.number().positive().max(100),
  maxScore: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().positive().max(1_000_000).optional()),
}).strict();

export const scoreSchema = z.object({
  organizationId: id,
  sessionId: id,
  entryId: id,
  criterionId: z.preprocess((value) => value === "" ? undefined : value, id.optional()),
  score: z.coerce.number().min(-1_000_000).max(1_000_000),
  penalty: z.coerce.number().min(0).max(1_000_000).default(0),
  notes: optionalText(1_000),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{8,160}$/),
}).strict();

export const phase19ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-competition"), data: genericCompetitionSchema }),
  z.object({ action: z.literal("create-participant"), data: participantSchema }),
  z.object({ action: z.literal("register-entry"), data: entrySchema }),
  z.object({ action: z.literal("create-session"), data: sessionSchema }),
  z.object({ action: z.literal("publish-session"), data: z.object({ organizationId: id, competitionId: id, sessionId: id }).strict() }),
  z.object({ action: z.literal("create-criterion"), data: criterionSchema }),
  z.object({ action: z.literal("record-score"), data: scoreSchema }),
  z.object({ action: z.literal("publish-results"), data: z.object({ organizationId: id, competitionId: id, sessionId: z.preprocess((value) => value === "" ? undefined : value, id.optional()) }).strict() }),
]);

export type GenericCompetitionInput = z.infer<typeof genericCompetitionSchema>;
export type ParticipantInput = z.infer<typeof participantSchema>;
export type EntryInput = z.infer<typeof entrySchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type CriterionInput = z.infer<typeof criterionSchema>;
export type ScoreInput = z.infer<typeof scoreSchema>;
