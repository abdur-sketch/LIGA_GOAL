import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { createRegistration, getDocumentForDownload, transitionRegistration } from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`; let organizationA: string; let organizationB: string; let userA: string; let userB: string; let competitionId: string; let seasonId: string; let clubId: string; let playerId: string; let registrationId: string;
const actor = () => ({ id: userA, isActive: true, isPlatformAdmin: false, deletedAt: null });

describe("Phase 2 registration security", () => {
  beforeAll(async () => {
    const [orgA, orgB] = await Promise.all([db.organization.create({ data: { name: "Phase2 A", slug: `phase2-a-${suffix}`, status: "ACTIVE" } }), db.organization.create({ data: { name: "Phase2 B", slug: `phase2-b-${suffix}`, status: "ACTIVE" } })]); organizationA = orgA.id; organizationB = orgB.id;
    const permissionKeys = ["registration.view", "registration.create", "player.view", "player_document.view"];
    const permissions = await Promise.all(permissionKeys.map((key) => db.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    const roleA = await db.role.create({ data: { organizationId: organizationA, name: "Registrar", key: `registrar-${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
    const roleB = await db.role.create({ data: { organizationId: organizationB, name: "Other", key: `other-${suffix}` } });
    const [firstUser, secondUser] = await Promise.all([db.user.create({ data: { name: "Registrar A", email: `registrar-a-${suffix}@test.invalid`, passwordHash: "test", memberships: { create: { organizationId: organizationA, roleId: roleA.id } } } }), db.user.create({ data: { name: "User B", email: `user-b-${suffix}@test.invalid`, passwordHash: "test", memberships: { create: { organizationId: organizationB, roleId: roleB.id } } } })]); userA = firstUser.id; userB = secondUser.id;
    const competition = await db.competition.create({ data: { organizationId: organizationA, name: "League", slug: `league-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "REGISTRATION" } }); competitionId = competition.id;
    const season = await db.season.create({ data: { competitionId, name: "2026", startsAt: new Date("2026-01-01"), endsAt: new Date("2026-12-31"), status: "ACTIVE" } }); seasonId = season.id;
    const club = await db.club.create({ data: { organizationId: organizationA, name: "Club A", shortName: "CLA", slug: `club-a-${suffix}` } }); clubId = club.id;
    await db.competitionClub.create({ data: { organizationId: organizationA, competitionId, seasonId, clubId, status: "APPROVED" } });
    const player = await db.player.create({ data: { organizationId: organizationA, fullName: "Same Player", dateOfBirth: new Date("2008-06-01") } }); playerId = player.id;
    const otherPlayer = await db.player.create({ data: { organizationId: organizationB, fullName: "Private Player" } });
    await db.playerDocument.create({ data: { organizationId: organizationB, playerId: otherPlayer.id, type: "IDENTITY", storageKey: `${organizationB}/00000000-0000-4000-8000-000000000000.pdf`, originalName: "identity.pdf", mimeType: "application/pdf", sizeBytes: 10, uploadedById: userB } });
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.playerDocumentVerification.deleteMany({ where: { document: { organizationId: { in: [organizationA, organizationB] } } } }); await db.playerDocument.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.eligibilityCheck.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.rosterEntry.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.registrationHistory.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.playerRegistration.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.competitionClub.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.playerPrivateProfile.deleteMany({ where: { player: { organizationId: { in: [organizationA, organizationB] } } } }); await db.player.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.season.deleteMany({ where: { competition: { organizationId: { in: [organizationA, organizationB] } } } }); await db.club.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.competition.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.organizationMember.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.role.deleteMany({ where: { organizationId: { in: [organizationA, organizationB] } } }); await db.user.deleteMany({ where: { id: { in: [userA, userB] } } }); await db.organization.deleteMany({ where: { id: { in: [organizationA, organizationB] } } }); await db.$disconnect();
  });
  it("creates registrations idempotently and blocks a duplicate active registration", async () => {
    const input = { competitionId, seasonId, clubId, playerId, jerseyNumber: 9, idempotencyKey: `phase2-${suffix}` }; const first = await createRegistration(actor(), organizationA, input); registrationId = first.id; const repeated = await createRegistration(actor(), organizationA, input); expect(repeated.id).toBe(first.id);
    await expect(createRegistration(actor(), organizationA, { ...input, idempotencyKey: `second-${suffix}` })).rejects.toMatchObject({ status: 409 });
  });
  it("denies approval when the actor lacks registration.approve", async () => { await db.playerRegistration.update({ where: { id: registrationId }, data: { status: "UNDER_REVIEW", verificationStatus: "VERIFIED" } }); await expect(transitionRegistration(actor(), organizationA, registrationId, "approve", {})).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>); });
  it("does not expose another tenant's private document", async () => { const document = await db.playerDocument.findFirstOrThrow({ where: { organizationId: organizationB } }); await expect(getDocumentForDownload(actor(), organizationB, document.id)).rejects.toMatchObject({ status: 403 }); });
  it("retains registration history when the player's active club changes", async () => { await db.player.update({ where: { id: playerId }, data: { activeClubId: clubId } }); expect(await db.registrationHistory.count({ where: { registrationId } })).toBeGreaterThan(0); });
});
