import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const optionalDate = z.string().datetime().or(z.string().date()).optional().nullable().transform((value) => value ? new Date(value) : null);

export const playerSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  displayName: optionalText(80),
  photoUrl: z.string().url().max(1000).optional().nullable().or(z.literal("")).transform((value) => value || null),
  dateOfBirth: optionalDate,
  placeOfBirth: optionalText(120),
  nationality: optionalText(80),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNDISCLOSED"]).default("UNDISCLOSED"),
  primaryPosition: optionalText(40),
  secondaryPositions: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
  preferredFoot: z.enum(["LEFT", "RIGHT", "BOTH"]).optional().nullable(),
  heightCm: z.coerce.number().int().min(80).max(250).optional().nullable(),
  weightKg: z.coerce.number().min(20).max(250).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED", "ARCHIVED"]).default("ACTIVE"),
  activeClubId: z.string().cuid().optional().nullable(),
  privateProfile: z.object({
    legalFullName: optionalText(160), address: optionalText(500), guardianName: optionalText(160),
    guardianContact: optionalText(100), identityLastFour: z.string().trim().regex(/^$|^[A-Za-z0-9]{4}$/).optional().nullable().transform((value) => value || null),
    privateNotes: optionalText(2000),
  }).optional(),
});

export const registrationSchema = z.object({
  competitionId: z.string().cuid(), seasonId: z.string().cuid(), clubId: z.string().cuid(), playerId: z.string().cuid(),
  jerseyNumber: z.coerce.number().int().min(0).max(999).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const workflowSchema = z.object({ reason: z.string().trim().max(1000).optional().nullable() }).default({});

export const documentMetaSchema = z.object({
  playerId: z.string().cuid(), registrationId: z.string().cuid().optional().nullable(),
  type: z.enum(["PHOTO", "IDENTITY", "AGE_PROOF", "PARENTAL_CONSENT", "ADDITIONAL"]),
  label: optionalText(120), replacedDocumentId: z.string().cuid().optional().nullable(),
});

export const documentVerificationSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]), notes: z.string().trim().max(1000).optional().nullable(),
}).superRefine((data, context) => {
  if (data.status === "REJECTED" && !data.notes) context.addIssue({ code: z.ZodIssueCode.custom, path: ["notes"], message: "Catatan penolakan wajib diisi." });
});

export const rosterSchema = z.object({
  registrationId: z.string().cuid(), jerseyNumber: z.coerce.number().int().min(0).max(999).optional().nullable(),
  position: optionalText(40),
});

export const competitionRulesSchema = z.object({
  age: z.object({ min: z.number().int().min(0).max(99).optional(), max: z.number().int().min(1).max(99).optional(), cutoffDate: z.string().date().optional() }).optional(),
  registrationWindow: z.object({ start: z.string().datetime().or(z.string().date()), end: z.string().datetime().or(z.string().date()) }).optional(),
  squadLimit: z.number().int().min(1).max(200).optional(), uniqueJersey: z.boolean().default(false), jerseyRequired: z.boolean().default(false),
  requiredDocuments: z.array(z.enum(["PHOTO", "IDENTITY", "AGE_PROOF", "PARENTAL_CONSENT", "ADDITIONAL"])).default([]),
}).default({ uniqueJersey: false, jerseyRequired: false, requiredDocuments: [] });

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;
