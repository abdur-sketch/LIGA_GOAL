import type { MatchStatus } from "@prisma/client";

const transitions: Record<MatchStatus, MatchStatus[]> = {
  DRAFT: ["SCHEDULED", "CANCELLED"],
  SCHEDULED: ["LINEUP_CONFIRMED", "POSTPONED", "CANCELLED"],
  LINEUP_CONFIRMED: ["LIVE_FIRST_HALF", "POSTPONED", "CANCELLED"],
  LIVE_FIRST_HALF: ["HALF_TIME", "ABANDONED"],
  HALF_TIME: ["LIVE_SECOND_HALF", "ABANDONED"],
  LIVE_SECOND_HALF: ["EXTRA_TIME", "FINISHED_PENDING_APPROVAL", "ABANDONED"],
  EXTRA_TIME: ["PENALTY_SHOOTOUT", "FINISHED_PENDING_APPROVAL", "ABANDONED"],
  PENALTY_SHOOTOUT: ["FINISHED_PENDING_APPROVAL", "ABANDONED"],
  FINISHED_PENDING_APPROVAL: ["OFFICIAL"],
  OFFICIAL: [],
  POSTPONED: ["SCHEDULED", "CANCELLED"],
  CANCELLED: [],
  ABANDONED: [],
};

export function canTransition(from: MatchStatus, to: MatchStatus) {
  return transitions[from].includes(to);
}

export function assertTransition(from: MatchStatus, to: MatchStatus) {
  if (!canTransition(from, to))
    throw new Error(`Transisi ${from} ke ${to} tidak diizinkan.`);
}

export function transitionsFrom(status: MatchStatus) {
  return [...transitions[status]];
}
