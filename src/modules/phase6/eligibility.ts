import { db } from "@/lib/db";
import { availabilityAt } from "./engine";

export type EligibilityAtMatch = {
  result: "ELIGIBLE" | "INELIGIBLE" | "PENDING_REVIEW";
  reasons: Array<{ code: string; message: string }>;
};

export async function eligibilityAt(
  organizationId: string,
  playerId: string,
  seasonId: string,
  clubId: string,
  at: Date | null,
): Promise<EligibilityAtMatch> {
  if (!at)
    return {
      result: "PENDING_REVIEW",
      reasons: [{ code: "MATCH_DATE_UNKNOWN", message: "Tanggal pertandingan belum tersedia." }],
    };
  const [registration, latestEffectiveTransfer, nextEffectiveTransfer] = await Promise.all([
    db.playerRegistration.findFirst({
    where: {
      organizationId,
      playerId,
      seasonId,
      clubId,
      OR: [
        { status: "APPROVED", rosterEntry: { status: "ACTIVE" } },
        {
          status: "CANCELLED",
          rosterEntry: { addedAt: { lte: at }, releasedAt: { gt: at } },
        },
      ],
    },
    include: { player: { select: { activeClubId: true, status: true, deletedAt: true } } },
    orderBy: { approvedAt: "desc" },
    }),
    db.transferRequest.findFirst({
      where: { organizationId, playerId, seasonId, status: "COMPLETED", effectiveAt: { lte: at } },
      orderBy: { effectiveAt: "desc" },
      select: { destinationClubId: true, type: true },
    }),
    db.transferRequest.findFirst({
      where: { organizationId, playerId, seasonId, status: "COMPLETED", effectiveAt: { gt: at }, sourceClubId: { not: null } },
      orderBy: { effectiveAt: "asc" },
      select: { sourceClubId: true },
    }),
  ]);
  if (!registration)
    return {
      result: "INELIGIBLE",
      reasons: [{ code: "REGISTRATION_INVALID", message: "Registrasi atau roster pemain tidak aktif." }],
    };
  const reasons: EligibilityAtMatch["reasons"] = [];
  if (registration.player.deletedAt || registration.player.status !== "ACTIVE")
    reasons.push({ code: "PLAYER_INACTIVE", message: "Profil pemain tidak aktif." });
  const effectiveClubId = latestEffectiveTransfer
    ? latestEffectiveTransfer.type === "REGISTRATION_RELEASE"
      ? null
      : latestEffectiveTransfer.destinationClubId
    : nextEffectiveTransfer?.sourceClubId ?? registration.player.activeClubId;
  if (effectiveClubId !== clubId)
    reasons.push({ code: "TRANSFER_NOT_EFFECTIVE", message: "Transfer atau klub aktif pemain belum efektif untuk klub ini." });

  const [periods, injury, disciplineRule, suspensions] = await Promise.all([
    db.playerAvailability.findMany({
      where: {
        organizationId,
        playerId,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gte: at } }],
      },
      select: { status: true, reason: true, startsAt: true, endsAt: true },
    }),
    db.injuryCase.findFirst({
      where: {
        organizationId,
        playerId,
        injuryDate: { lte: at },
        status: { in: ["OPEN", "RECOVERING"] },
        NOT: { clearances: { some: { status: "APPROVED", clearedAt: { lte: at } } } },
      },
      select: { id: true },
    }),
    db.competitionRule.findFirst({
      where: { competition: { seasons: { some: { id: seasonId } } }, key: "discipline_rules" },
      select: { value: true },
    }),
    db.suspension.findMany({
      where: {
        organizationId,
        playerId,
        seasonId,
        status: "ACTIVE",
        effectiveAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gte: at } }],
      },
      select: { reason: true, appealStatus: true, remainingMatchBans: true, endsAt: true },
    }),
  ]);
  const availability = availabilityAt(periods, at);
  for (const reason of availability.reasons)
    reasons.push({ code: "AVAILABILITY", message: reason });
  if (injury && !reasons.some((reason) => reason.message.includes("cedera")))
    reasons.push({ code: "MEDICAL_CLEARANCE_REQUIRED", message: "Cedera belum memiliki medical clearance." });
  const rules = (disciplineRule?.value ?? {}) as Record<string, unknown>;
  for (const suspension of suspensions) {
    if (suspension.appealStatus === "PENDING" && rules.appealSuspendsSanction === true) continue;
    if (suspension.remainingMatchBans === 0 && !suspension.endsAt) continue;
    reasons.push({ code: "PLAYER_SUSPENDED", message: suspension.reason });
  }
  return { result: reasons.length ? "INELIGIBLE" : "ELIGIBLE", reasons };
}

export const databaseSuspensionGateway = {
  async check(playerId: string, seasonId: string) {
    const suspension = await db.suspension.findFirst({
      where: {
        playerId,
        seasonId,
        status: "ACTIVE",
        effectiveAt: { lte: new Date() },
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
      },
    });
    return { available: true, suspended: Boolean(suspension) };
  },
};
