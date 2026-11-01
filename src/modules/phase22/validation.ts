import { z } from "zod";

export const privacyRequestSchema = z.object({
  registrationNumber: z.string().trim().regex(/^PL-[A-Z0-9]{12}$/),
  registrationToken: z.string().trim().min(32).max(128),
  type: z.enum(["ACCESS", "CORRECTION", "ERASURE"]),
  requesterEmail: z.string().trim().toLowerCase().email().max(254),
  description: z.string().trim().min(5).max(2_000).optional(),
  idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9:_-]{12,160}$/),
}).strict();

export const retentionPreviewSchema = z.object({
  organizationId: z.string().trim().min(1).max(96),
  asOf: z.coerce.date().default(() => new Date()),
}).strict();
