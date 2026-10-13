import { z } from "zod";

const id = z.string().trim().min(1).max(128);
const reason = z.string().trim().min(8).max(2_000);

export const verificationSubmissionSchema = z.object({
  organizationId: id,
  evidence: z.record(z.string(), z.string().trim().max(500)).refine((value) => Object.keys(value).length <= 12, "Bukti terlalu banyak."),
});

export const verificationReviewSchema = z.object({
  id,
  version: z.number().int().positive(),
  action: z.enum(["verify", "reject", "suspend"]),
  reason,
});

export const abuseReportSchema = z.object({
  targetType: z.enum(["ORGANIZER", "COMPETITION"]),
  targetId: id,
  category: z.enum(["IMPERSONATION", "FRAUD", "HARASSMENT", "ILLEGAL_CONTENT", "MISLEADING", "OTHER"]),
  description: z.string().trim().min(20).max(2_000),
  reporterContact: z.string().trim().email().max(254).optional(),
}).strict();

export const moderationReviewSchema = z.object({
  reportId: id,
  version: z.number().int().positive(),
  action: z.enum(["review", "dismiss", "suspend_organizer", "unpublish_competition"]),
  reason,
});

export const moderationNoteSchema = z.object({ reportId: id, body: reason });
export const moderationAppealSchema = z.object({ organizationId: id, reportId: id, reason });
export const appealReviewSchema = z.object({ appealId: id, action: z.enum(["uphold", "overturn"]), reason });
export const organizationStateSchema = z.object({ organizationId: id, action: z.enum(["suspend", "reactivate"]), reason });
