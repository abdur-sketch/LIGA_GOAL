import { z } from "zod";

const id = z.string().trim().min(1).max(96);
const optionalId = z.preprocess((value) => value === "" ? undefined : value, id.optional());
const optionalText = (max: number) => z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(max).optional());
const optionalDate = z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.date().optional());

export const judgeAssignmentSchema = z.object({
  organizationId: id,
  competitionId: id,
  sessionId: optionalId,
  stageId: optionalId,
  judgeId: id,
  validFrom: optionalDate,
  validUntil: optionalDate,
  conflictDeclared: z.coerce.boolean().default(false),
  conflictNotes: optionalText(1_000),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{8,160}$/),
}).strict().refine((value) => !value.validUntil || !value.validFrom || value.validUntil > value.validFrom, { path: ["validUntil"], message: "Masa berlaku penugasan tidak valid." })
  .refine((value) => !value.conflictDeclared || Boolean(value.conflictNotes?.trim()), { path: ["conflictNotes"], message: "Konflik kepentingan wajib dijelaskan." });

export const registrationConfigSchema = z.object({
  organizationId: id,
  competitionId: id,
  enabled: z.coerce.boolean(),
  opensAt: optionalDate,
  closesAt: optionalDate,
  quota: z.preprocess((value) => value === "" || value == null ? undefined : value, z.coerce.number().int().positive().max(1_000_000).optional()),
  requirements: z.array(z.string().trim().min(2).max(160)).max(30).default([]),
}).strict().refine((value) => !value.opensAt || !value.closesAt || value.closesAt >= value.opensAt, { path: ["closesAt"], message: "Periode pendaftaran tidak valid." });

const safeJson = z.record(z.string(), z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()])).default({});
const documentSchema = z.object({
  storageKey: z.string().regex(/^[a-zA-Z0-9_-]+\/[a-f0-9-]+\.(pdf|jpg|png|webp)$/),
  originalName: z.string().trim().min(1).max(240),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(8 * 1024 * 1024),
}).strict();

export const publicRegistrationSchema = z.object({
  publicSlug: z.string().trim().toLowerCase().min(2).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  participantType: z.enum(["INDIVIDUAL", "TEAM", "INSTITUTION"]),
  participantName: z.string().trim().min(2).max(160),
  institution: optionalText(160),
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: optionalText(40),
  teamData: safeJson,
  formData: safeJson,
  documents: z.array(documentSchema).max(10).default([]),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{12,160}$/),
  website: z.string().max(0).optional(),
}).strict();

export const registrationReviewSchema = z.object({
  organizationId: id,
  registrationId: id,
  action: z.enum(["start-review", "request-revision", "approve", "reject"]),
  reason: optionalText(2_000),
}).strict().refine((value) => !["request-revision", "reject"].includes(value.action) || Boolean(value.reason?.trim()), { path: ["reason"], message: "Alasan wajib diisi." });

export const resultWorkflowSchema = z.object({
  organizationId: id,
  competitionId: id,
  sessionId: optionalId,
  action: z.enum(["submit", "review", "approve", "publish", "reopen"]),
  reason: optionalText(2_000),
}).strict().refine((value) => value.action !== "reopen" || Boolean(value.reason?.trim()), { path: ["reason"], message: "Alasan pembukaan kembali wajib diisi." });

export const phase21OrganizerActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure-registration"), data: registrationConfigSchema }),
  z.object({ action: z.literal("assign-judge"), data: judgeAssignmentSchema }),
  z.object({ action: z.literal("revoke-judge"), data: z.object({ organizationId: id, assignmentId: id, reason: z.string().trim().min(3).max(1_000) }).strict() }),
  z.object({ action: z.literal("review-registration"), data: registrationReviewSchema }),
  z.object({ action: z.literal("result-workflow"), data: resultWorkflowSchema }),
]);

export const registrationStatusSchema = z.object({
  registrationNumber: z.string().trim().regex(/^PL-[A-Z0-9]{12}$/),
  token: z.string().trim().min(32).max(128),
}).strict();
