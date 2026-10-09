import { z } from "zod";

export const phase4QuerySchema = z.object({
  organizationId: z.string().min(1),
  search: z.string().max(120).default(""),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const lineupSchema = z.object({
  teamId: z.string().min(1),
  formation: z.string().trim().min(2).max(20),
  reason: z.string().trim().min(3).max(500).optional(),
  players: z
    .array(
      z.object({
        registrationId: z.string().min(1),
        playerId: z.string().min(1),
        role: z.enum(["STARTER", "SUBSTITUTE"]),
        shirtNumber: z.number().int().min(1).max(99),
        position: z.string().trim().max(40).optional(),
        isCaptain: z.boolean().default(false),
        isGoalkeeper: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(30),
});

export const transitionSchema = z.object({
  status: z.enum([
    "DRAFT",
    "SCHEDULED",
    "LINEUP_CONFIRMED",
    "LIVE_FIRST_HALF",
    "HALF_TIME",
    "LIVE_SECOND_HALF",
    "EXTRA_TIME",
    "PENALTY_SHOOTOUT",
    "FINISHED_PENDING_APPROVAL",
    "OFFICIAL",
    "POSTPONED",
    "CANCELLED",
    "ABANDONED",
  ]),
  expectedVersion: z.number().int().positive(),
});

export const eventSchema = z.object({
  idempotencyKey: z.string().min(8).max(100),
  eventType: z.enum([
    "KICK_OFF",
    "GOAL",
    "ASSIST",
    "OWN_GOAL",
    "PENALTY_GOAL",
    "PENALTY_MISSED",
    "YELLOW_CARD",
    "SECOND_YELLOW_CARD",
    "RED_CARD",
    "SUBSTITUTION",
    "HALF_TIME",
    "SECOND_HALF_KICK_OFF",
    "FULL_TIME",
    "EXTRA_TIME_START",
    "EXTRA_TIME_END",
    "SHOOTOUT_GOAL",
    "SHOOTOUT_MISSED",
  ]),
  period: z.enum([
    "PRE_MATCH",
    "FIRST_HALF",
    "HALF_TIME",
    "SECOND_HALF",
    "EXTRA_TIME_FIRST",
    "EXTRA_TIME_BREAK",
    "EXTRA_TIME_SECOND",
    "PENALTY_SHOOTOUT",
    "FULL_TIME",
  ]),
  teamId: z.string().min(1).nullable().optional(),
  playerId: z.string().min(1).nullable().optional(),
  relatedPlayerId: z.string().min(1).nullable().optional(),
  minute: z.number().int().min(0).max(180),
  addedTime: z.number().int().min(0).max(30).default(0),
  payload: z.record(z.string(), z.unknown()).optional(),
  expectedVersion: z.number().int().positive(),
});

export const eventCorrectionSchema = eventSchema
  .omit({ idempotencyKey: true, expectedVersion: true })
  .partial()
  .extend({
    isValid: z.boolean().optional(),
    reason: z.string().trim().min(3).max(500),
  });

export const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2000).optional(),
  refereeNotes: z.string().trim().max(2000).optional(),
});

export const correctionRequestSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
});

export const correctionReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().trim().max(2000).optional(),
});
