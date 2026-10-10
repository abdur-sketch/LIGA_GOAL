import { z } from "zod";

const scope = {
  organizationId: z.string().min(1),
  competitionId: z.string().min(1),
  seasonId: z.string().min(1),
};

export const transferSchema = z.object({
  ...scope,
  playerId: z.string().min(1),
  sourceClubId: z.string().min(1).nullable().optional(),
  destinationClubId: z.string().min(1).nullable().optional(),
  transferWindowId: z.string().min(1).nullable().optional(),
  type: z.enum(["PERMANENT", "LOAN", "LOAN_RETURN", "FREE_AGENT_SIGNING", "REGISTRATION_RELEASE"]),
  effectiveAt: z.coerce.date().nullable().optional(),
  supportingDocs: z.array(z.string().min(1)).max(20).default([]),
  idempotencyKey: z.string().min(8).max(120),
});

export const transferActionSchema = z.object({
  action: z.enum(["submit", "review", "approve", "reject", "cancel", "complete"]),
  step: z.enum(["SOURCE_CLUB", "DESTINATION_CLUB", "COMPETITION", "OVERRIDE"]).optional(),
  expectedVersion: z.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(8).max(500).optional(),
  overrideWindow: z.boolean().default(false),
});

export const transferWindowSchema = z.object({
  ...scope,
  name: z.string().trim().min(3).max(120),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  registrationDeadline: z.coerce.date().nullable().optional(),
  status: z.enum(["OPEN", "CLOSED"]).default("OPEN"),
  rules: z.record(z.string(), z.unknown()).default({}),
});

export const availabilitySchema = z.object({
  organizationId: z.string().min(1),
  playerId: z.string().min(1),
  status: z.enum(["AVAILABLE", "INJURED", "RECOVERING", "SUSPENDED", "UNAVAILABLE"]),
  reason: z.string().trim().min(3).max(500),
  publicNote: z.string().trim().max(300).nullable().optional(),
  publicApproved: z.boolean().default(false),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
});

export const injurySchema = z.object({
  organizationId: z.string().min(1),
  playerId: z.string().min(1),
  injuryDate: z.coerce.date(),
  estimatedReturn: z.coerce.date().nullable().optional(),
  diagnosis: z.string().trim().max(1000).nullable().optional(),
  medicalNotes: z.string().trim().max(3000).nullable().optional(),
  publicNote: z.string().trim().max(300).nullable().optional(),
  publicApproved: z.boolean().default(false),
});

export const injuryProgressSchema = z.object({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["OPEN", "RECOVERING", "CLOSED"]),
  privateNotes: z.string().trim().max(3000).nullable().optional(),
  publicNote: z.string().trim().max(300).nullable().optional(),
});

export const clearanceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  clearedAt: z.coerce.date(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const suspensionSchema = z.object({
  ...scope,
  playerId: z.string().min(1),
  reason: z.string().trim().min(8).max(500),
  effectiveAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable().optional(),
  matchBans: z.number().int().positive().max(100).nullable().optional(),
});

export const decisionSchema = z.object({
  type: z.enum(["WARNING", "MATCH_BAN", "DATE_SUSPENSION", "POINT_PENALTY", "DISMISSED"]),
  reason: z.string().trim().min(8).max(1000),
  matchBans: z.number().int().positive().max(100).nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  pointPenalty: z.number().int().negative().min(-100).nullable().optional(),
  clubId: z.string().min(1).optional(),
});

export const disciplinaryCaseSchema = z.object({
  ...scope,
  playerId: z.string().min(1),
  matchId: z.string().min(1).nullable().optional(),
  eventId: z.string().min(1).nullable().optional(),
  summary: z.string().trim().min(8).max(1000),
});

export const appealSchema = z.object({
  reason: z.string().trim().min(8).max(1000),
});
