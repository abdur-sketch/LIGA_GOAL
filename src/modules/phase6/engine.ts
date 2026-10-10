export type ApprovalStep = "SOURCE_CLUB" | "DESTINATION_CLUB" | "COMPETITION";

export function requiredApprovalSteps(
  configured: ApprovalStep[],
  sourceClubId: string | null,
  destinationClubId: string | null,
) {
  const steps = configured.length
    ? [...new Set(configured)]
    : (["SOURCE_CLUB", "DESTINATION_CLUB", "COMPETITION"] as ApprovalStep[]);
  return steps.filter(
    (step) =>
      (step !== "SOURCE_CLUB" || Boolean(sourceClubId)) &&
      (step !== "DESTINATION_CLUB" || Boolean(destinationClubId)),
  );
}

export function nextTransferStatus(
  steps: ApprovalStep[],
  approved: ApprovalStep[],
) {
  const missing = steps.find((step) => !approved.includes(step));
  if (missing === "SOURCE_CLUB") return "UNDER_REVIEW" as const;
  if (missing === "DESTINATION_CLUB") return "SOURCE_CLUB_APPROVED" as const;
  if (missing === "COMPETITION") return "DESTINATION_CLUB_APPROVED" as const;
  return "COMPETITION_APPROVED" as const;
}

export type AvailabilityPeriod = {
  status: "AVAILABLE" | "INJURED" | "RECOVERING" | "SUSPENDED" | "UNAVAILABLE";
  reason: string;
  startsAt: Date;
  endsAt: Date | null;
};

export function availabilityAt(periods: AvailabilityPeriod[], at: Date) {
  const active = periods.filter(
    (period) => period.startsAt <= at && (!period.endsAt || period.endsAt >= at),
  );
  const blockers = active.filter((period) => period.status !== "AVAILABLE");
  return {
    available: blockers.length === 0,
    status: blockers[0]?.status ?? "AVAILABLE",
    reasons: blockers.map((period) => period.reason),
  };
}

export type CardEvent = {
  id: string;
  playerId: string | null;
  type: "YELLOW_CARD" | "SECOND_YELLOW_CARD" | "RED_CARD";
  isValid: boolean;
  matchStatus: string;
};

export type DisciplineRules = {
  yellowThreshold: number;
  yellowMatchBans: number;
  secondYellowMatchBans: number;
  redCardMatchBans: number;
};

export function automaticSuspensionSpecs(
  events: CardEvent[],
  seasonId: string,
  rules: DisciplineRules,
) {
  const official = events.filter(
    (event) => event.isValid && event.matchStatus === "OFFICIAL" && event.playerId,
  );
  const byPlayer = new Map<string, CardEvent[]>();
  for (const event of official)
    byPlayer.set(event.playerId!, [...(byPlayer.get(event.playerId!) ?? []), event]);
  const specs: Array<{
    sourceKey: string;
    playerId: string;
    reason: string;
    matchBans: number;
    eventId?: string;
  }> = [];
  for (const [playerId, playerEvents] of byPlayer) {
    const yellows = playerEvents.filter((event) => event.type === "YELLOW_CARD");
    const thresholds = Math.floor(yellows.length / Math.max(1, rules.yellowThreshold));
    for (let index = 1; index <= thresholds; index += 1)
      specs.push({
        sourceKey: `yellow:${seasonId}:${playerId}:${index}`,
        playerId,
        reason: `Akumulasi ${rules.yellowThreshold} kartu kuning`,
        matchBans: rules.yellowMatchBans,
        eventId: yellows[index * Math.max(1, rules.yellowThreshold) - 1]?.id,
      });
    for (const event of playerEvents) {
      if (event.type === "SECOND_YELLOW_CARD")
        specs.push({ sourceKey: `second-yellow:${event.id}`, playerId, reason: "Kartu kuning kedua", matchBans: rules.secondYellowMatchBans, eventId: event.id });
      if (event.type === "RED_CARD")
        specs.push({ sourceKey: `red:${event.id}`, playerId, reason: "Kartu merah langsung", matchBans: rules.redCardMatchBans, eventId: event.id });
    }
  }
  return specs;
}

export function shouldCountMatchBan(status: string) {
  return status === "OFFICIAL";
}
