import { beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { eligibilityAt } from "./eligibility";
import {
  actionTransfer,
  clearInjury,
  createInjury,
  createDisciplinaryCase,
  createManualSuspension,
  createTransfer,
  createTransferWindow,
  decideDiscipline,
  listTransfers,
  publicAvailability,
  reconcileDiscipline,
  serveSuspensionsForOfficialMatch,
} from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId = "";
let otherOrganizationId = "";
let actorId = "";
let competitionId = "";
let seasonId = "";
let sourceClubId = "";
let destinationClubId = "";
let playerId = "";
let transferWindowId = "";
let sourceMatchId = "";
let nextMatchId = "";

const actor = () => ({ id: actorId, isActive: true, isPlatformAdmin: false, deletedAt: null });
const query = (org = organizationId) => ({ organizationId: org, search: "", page: 1, pageSize: 20 });

describe.sequential("Phase 6 player operations", () => {
  beforeAll(async () => {
    const [organization, other] = await Promise.all([
      db.organization.create({ data: { name: "Player Ops Tenant", slug: `ops-${suffix}`, status: "ACTIVE" } }),
      db.organization.create({ data: { name: "Other Player Ops", slug: `ops-other-${suffix}`, status: "ACTIVE" } }),
    ]);
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const permissionKeys = ["transfer.view", "transfer.request", "transfer.review", "transfer.approve", "transfer.cancel", "transfer_window.view", "transfer_window.manage", "availability.view", "availability.manage", "injury.view", "injury.manage", "injury.clearance", "discipline.view", "discipline.manage", "discipline.approve", "discipline.appeal", "suspension.view", "suspension.manage"];
    const permissions = await Promise.all(permissionKeys.map((key) => db.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    const role = await db.role.create({ data: { organizationId, name: "Player Operations", key: `ops-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
    const user = await db.user.create({ data: { name: "Player Ops", email: `ops-${suffix}@test.invalid`, passwordHash: "test", memberships: { create: { organizationId, roleId: role.id } } } });
    actorId = user.id;
    const competition = await db.competition.create({ data: { organizationId, name: "Operations League", slug: `ops-league-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "ONGOING" } });
    competitionId = competition.id;
    await db.competitionRule.create({ data: { competitionId, key: "discipline_rules", value: { yellowThreshold: 3, redCardMatchBans: 1 } } });
    const season = await db.season.create({ data: { competitionId, name: `2026 ${suffix}`, startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), status: "ACTIVE", isActive: true } });
    seasonId = season.id;
    const stage = await db.stage.create({ data: { organizationId, seasonId, name: "League", sortOrder: 1, type: "ROUND_ROBIN", format: "SINGLE_ROUND_ROBIN" } });
    const [source, destination] = await Promise.all([
      db.club.create({ data: { organizationId, name: "Source FC", shortName: "SRC", slug: `source-${suffix}` } }),
      db.club.create({ data: { organizationId, name: "Destination FC", shortName: "DST", slug: `destination-${suffix}` } }),
    ]);
    sourceClubId = source.id;
    destinationClubId = destination.id;
    for (const club of [source, destination]) await db.competitionClub.create({ data: { organizationId, competitionId, seasonId, clubId: club.id, status: "APPROVED" } });
    const [sourceTeam, destinationTeam] = await Promise.all([
      db.team.create({ data: { competitionId, clubId: source.id, name: source.name } }),
      db.team.create({ data: { competitionId, clubId: destination.id, name: destination.name } }),
    ]);
    const player = await db.player.create({ data: { organizationId, activeClubId: source.id, fullName: "Transfer Target", status: "ACTIVE" } });
    playerId = player.id;
    await db.playerRegistration.create({ data: { organizationId, competitionId, seasonId, clubId: source.id, playerId, idempotencyKey: `original-${suffix}`, registrationDate: new Date("2026-01-02"), status: "APPROVED", verificationStatus: "VERIFIED", eligibilityStatus: "ELIGIBLE", rosterEntry: { create: { organizationId, seasonId, clubId: source.id, addedAt: new Date("2026-01-02"), status: "ACTIVE" } } } });
    const window = await createTransferWindow(actor(), { organizationId, competitionId, seasonId, name: `Main ${suffix}`, opensAt: new Date(Date.now() - 86_400_000), closesAt: new Date(Date.now() + 86_400_000), registrationDeadline: new Date(Date.now() + 86_400_000), status: "OPEN", rules: {} });
    transferWindowId = window.id;
    const sourceMatch = await db.match.create({ data: { organizationId, competitionId, seasonId, stageId: stage.id, homeTeamId: sourceTeam.id, awayTeamId: destinationTeam.id, matchNumber: 91, kickoffAt: new Date("2026-05-01T12:00:00Z"), status: "OFFICIAL", homeScore: 0, awayScore: 0 } });
    const nextMatch = await db.match.create({ data: { organizationId, competitionId, seasonId, stageId: stage.id, homeTeamId: destinationTeam.id, awayTeamId: sourceTeam.id, matchNumber: 92, kickoffAt: new Date("2026-05-08T12:00:00Z"), status: "OFFICIAL", homeScore: 0, awayScore: 0 } });
    sourceMatchId = sourceMatch.id;
    nextMatchId = nextMatch.id;
  });

  it("completes an idempotent, approval-ordered transfer while preserving history", async () => {
    const input = { organizationId, competitionId, seasonId, playerId, sourceClubId, destinationClubId, transferWindowId, type: "PERMANENT" as const, effectiveAt: new Date(Date.now() - 1_000), supportingDocs: [], idempotencyKey: `transfer-${suffix}` };
    const draft = await createTransfer(actor(), input);
    expect((await createTransfer(actor(), input)).id).toBe(draft.id);
    await expect(createTransfer(actor(), { ...input, idempotencyKey: `duplicate-${suffix}` })).rejects.toMatchObject({ status: 409 } satisfies Partial<ApiError>);
    let transfer = await actionTransfer(actor(), organizationId, draft.id, { action: "submit", expectedVersion: 1, overrideWindow: false });
    transfer = await actionTransfer(actor(), organizationId, draft.id, { action: "review", expectedVersion: transfer.version, overrideWindow: false });
    for (const step of ["SOURCE_CLUB", "DESTINATION_CLUB", "COMPETITION"] as const)
      transfer = await actionTransfer(actor(), organizationId, draft.id, { action: "approve", step, expectedVersion: transfer.version, overrideWindow: false });
    transfer = await actionTransfer(actor(), organizationId, draft.id, { action: "complete", expectedVersion: transfer.version, overrideWindow: false });
    expect(transfer.status).toBe("COMPLETED");
    const registrations = await db.playerRegistration.findMany({ where: { playerId, seasonId }, orderBy: { createdAt: "asc" } });
    expect(registrations).toHaveLength(2);
    expect(registrations.map((item) => [item.clubId, item.status])).toEqual([[sourceClubId, "CANCELLED"], [destinationClubId, "APPROVED"]]);
    expect((await db.transferHistory.count({ where: { transferId: draft.id } }))).toBeGreaterThanOrEqual(7);
    expect((await eligibilityAt(organizationId, playerId, seasonId, sourceClubId, new Date("2026-05-02"))).result).toBe("ELIGIBLE");
  });

  it("rejects a closed transfer window without changing the active club", async () => {
    const closed = await createTransferWindow(actor(), { organizationId, competitionId, seasonId, name: `Closed ${suffix}`, opensAt: new Date("2026-01-01"), closesAt: new Date("2026-01-02"), registrationDeadline: new Date("2026-01-02"), status: "CLOSED", rules: {} });
    const draft = await createTransfer(actor(), { organizationId, competitionId, seasonId, playerId, sourceClubId: destinationClubId, destinationClubId: sourceClubId, transferWindowId: closed.id, type: "PERMANENT", effectiveAt: new Date(), supportingDocs: [], idempotencyKey: `closed-${suffix}` });
    await expect(actionTransfer(actor(), organizationId, draft.id, { action: "submit", expectedVersion: 1, overrideWindow: false })).rejects.toMatchObject({ status: 422 } satisfies Partial<ApiError>);
    expect((await db.player.findUniqueOrThrow({ where: { id: playerId } })).activeClubId).toBe(destinationClubId);
  });

  it("blocks injury availability until clearance and keeps private medical fields out of public data", async () => {
    const injury = await createInjury(actor(), { organizationId, playerId, injuryDate: new Date("2026-10-10"), estimatedReturn: null, diagnosis: "Private diagnosis", medicalNotes: "Private medical notes", publicNote: "Dalam pemulihan", publicApproved: true });
    const blocked = await eligibilityAt(organizationId, playerId, seasonId, destinationClubId, new Date("2026-10-11"));
    expect(blocked.result).toBe("INELIGIBLE");
    expect(JSON.stringify(await publicAvailability(organizationId, playerId, new Date("2026-10-11")))).not.toContain("Private diagnosis");
    await clearInjury(actor(), organizationId, injury.id, { expectedVersion: 1, clearedAt: new Date("2026-10-12"), notes: "Fit to play" });
    expect((await eligibilityAt(organizationId, playerId, seasonId, destinationClubId, new Date("2026-10-13"))).result).toBe("ELIGIBLE");
  });

  it("derives bans only from valid official cards, preserves manual sanctions, and serves an official match once", async () => {
    const manual = await createManualSuspension(actor(), { organizationId, competitionId, seasonId, playerId, reason: "Manual sanction remains active", effectiveAt: new Date("2026-07-01"), endsAt: new Date("2026-07-02"), matchBans: null });
    const red = await db.matchEvent.create({ data: { organizationId, matchId: sourceMatchId, idempotencyKey: `red-${suffix}`, eventType: "RED_CARD", period: "SECOND_HALF", teamId: null, playerId, minute: 80, isValid: true, operatorId: actorId } });
    for (let index = 1; index <= 3; index += 1)
      await db.matchEvent.create({ data: { organizationId, matchId: sourceMatchId, idempotencyKey: `yellow-${index}-${suffix}`, eventType: "YELLOW_CARD", period: "SECOND_HALF", teamId: null, playerId, minute: 20 + index, isValid: true, operatorId: actorId } });
    await reconcileDiscipline(actor(), organizationId, competitionId, seasonId);
    const automatic = await db.suspension.findFirstOrThrow({ where: { organizationId, sourceKey: `red:${red.id}` } });
    expect(await db.suspension.findFirst({ where: { organizationId, sourceKey: `yellow:${seasonId}:${playerId}:1` } })).toBeTruthy();
    expect(automatic.remainingMatchBans).toBe(1);
    expect((await eligibilityAt(organizationId, playerId, seasonId, sourceClubId, new Date("2026-05-02"))).result).toBe("INELIGIBLE");
    const matchScope = await db.match.findUniqueOrThrow({ where: { id: sourceMatchId } });
    const cancelled = await db.match.create({ data: { organizationId, competitionId, seasonId, stageId: matchScope.stageId, homeTeamId: matchScope.homeTeamId, awayTeamId: matchScope.awayTeamId, matchNumber: 93, kickoffAt: new Date("2026-05-04T12:00:00Z"), status: "CANCELLED" } });
    expect((await serveSuspensionsForOfficialMatch(organizationId, cancelled.id)).served).toBe(0);
    expect((await db.suspension.findUniqueOrThrow({ where: { id: automatic.id } })).remainingMatchBans).toBe(1);
    await serveSuspensionsForOfficialMatch(organizationId, nextMatchId);
    await serveSuspensionsForOfficialMatch(organizationId, nextMatchId);
    expect(await db.suspensionService.count({ where: { suspensionId: automatic.id, matchId: nextMatchId } })).toBe(1);
    expect((await db.suspension.findUniqueOrThrow({ where: { id: automatic.id } })).status).toBe("SERVED");
    await db.matchEvent.update({ where: { id: red.id }, data: { isValid: false } });
    await reconcileDiscipline(actor(), organizationId, competitionId, seasonId);
    expect((await db.suspension.findUniqueOrThrow({ where: { id: automatic.id } })).status).toBe("CANCELLED");
    expect((await db.suspension.findUniqueOrThrow({ where: { id: manual.id } })).status).toBe("ACTIVE");
  });

  it("integrates disciplinary point deductions with Phase 5", async () => {
    const disciplinaryCase = await createDisciplinaryCase(actor(), { organizationId, competitionId, seasonId, playerId, summary: "Pelanggaran administratif berat" });
    await decideDiscipline(actor(), organizationId, disciplinaryCase.id, { type: "POINT_PENALTY", reason: "Keputusan pengurangan tiga poin", pointPenalty: -3, clubId: destinationClubId, startsAt: new Date(), endsAt: null, matchBans: null });
    expect(await db.pointAdjustment.findFirst({ where: { organizationId, seasonId, clubId: destinationClubId, amount: -3 } })).toBeTruthy();
  });

  it("enforces RBAC and tenant isolation", async () => {
    await expect(listTransfers(actor(), query(otherOrganizationId))).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
  });
});
