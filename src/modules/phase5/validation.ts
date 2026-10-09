import { z } from "zod";

export const statisticsScopeSchema = z.object({
  organizationId: z.string().min(1),
  competitionId: z.string().min(1),
  seasonId: z.string().min(1),
  stageId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
});

export const recomputeSchema = statisticsScopeSchema.extend({
  idempotencyKey: z.string().min(8).max(120),
});

export const pointAdjustmentSchema = statisticsScopeSchema.extend({
  clubId: z.string().min(1),
  amount: z.number().int().min(-100).max(100).refine((value) => value !== 0),
  reason: z.string().trim().min(8).max(500),
  effectiveAt: z.coerce.date(),
});

export type StatisticsScope = z.infer<typeof statisticsScopeSchema>;

export function scopeKey(scope: StatisticsScope) {
  return [
    scope.competitionId,
    scope.seasonId,
    scope.stageId ?? "all-stages",
    scope.groupId ?? "all-groups",
  ].join(":");
}
