import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listPublicPlayers } from "@/modules/phase7/service";
import { grantPublicationConsent, withdrawPublicationConsent } from "./privacy";

const suffix = Date.now().toString(36); let organizationId = ""; let playerId = ""; let actorId = "";
const minorName = `Synthetic Minor ${suffix}`;
const actor = () => ({ id: actorId, isActive: true, isPlatformAdmin: true, deletedAt: null });

describe("publication consent and withdrawal", () => {
  beforeAll(async () => {
    const user = await db.user.create({ data: { email: `privacy-${suffix}@test.invalid`, name: "Privacy Officer", passwordHash: "test", isPlatformAdmin: true } }); actorId = user.id;
    const organization = await db.organization.create({ data: { name: "Privacy Tenant", slug: `privacy-${suffix}`, status: "ACTIVE" } }); organizationId = organization.id;
    const player = await db.player.create({ data: { organizationId, fullName: minorName, dateOfBirth: new Date("2015-01-01"), status: "ACTIVE" } }); playerId = player.id;
  });
  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorId } }); await db.publicationConsent.deleteMany({ where: { playerId } }); await db.player.deleteMany({ where: { id: playerId } }); await db.organization.deleteMany({ where: { id: organizationId } }); await db.user.deleteMany({ where: { id: actorId } });
  });
  it("requires guardian confirmation for a minor and removes publication immediately on withdrawal", async () => {
    await expect(grantPublicationConsent(actor(), { organizationId, playerId, legalBasis: "guardian consent", guardianConfirmed: false, evidenceReference: "synthetic-evidence-1" })).rejects.toMatchObject({ status: 422 });
    const consent = await grantPublicationConsent(actor(), { organizationId, playerId, legalBasis: "guardian consent", guardianConfirmed: true, evidenceReference: "synthetic-evidence-2" });
    expect((await listPublicPlayers(minorName)).some((player) => player.id === playerId)).toBe(true);
    await withdrawPublicationConsent(actor(), consent.id, { organizationId, reason: "Guardian withdrew consent" });
    expect((await listPublicPlayers(minorName)).some((player) => player.id === playerId)).toBe(false);
  });
});
