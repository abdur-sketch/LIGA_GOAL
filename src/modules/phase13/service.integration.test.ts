import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import {
  createInvitation,
  provisionOrganization,
  registerOrganizer,
  respondToInvitation,
  tokenDigest,
  verifyEmail,
} from "./service";

const owner = process.env.RLS_OWNER_DATABASE_URL ? new PrismaClient({ datasources: { db: { url: process.env.RLS_OWNER_DATABASE_URL } } }) : null;
const setupDb = owner ?? db;
const suffix = crypto.randomUUID().slice(0, 8);
const ownerEmail = `phase13-owner-${suffix}@example.test`;
const staffEmail = `phase13-staff-${suffix}@example.test`;
const outsiderEmail = `phase13-outsider-${suffix}@example.test`;
const expiredEmail = `phase13-expired-${suffix}@example.test`;
let ownerId = ""; let staffId = ""; let outsiderId = ""; let organizationId = "";
const actor = (id: string) => ({ id, isActive: true, isPlatformAdmin: false, deletedAt: null });

describe("Phase 13 self-service lifecycle", () => {
  beforeAll(async () => {
    for (const [email, name] of [[staffEmail, "Staff"], [outsiderEmail, "Outsider"]]) {
      const user = await setupDb.user.create({ data: { email, name, passwordHash: await hash("Strong!Password1", 4), emailVerifiedAt: new Date(), isActive: true } });
      if (email === staffEmail) staffId = user.id; else outsiderId = user.id;
    }
  });

  afterAll(async () => {
    if (organizationId) {
      await setupDb.auditLog.deleteMany({ where: { organizationId } });
      await setupDb.organizationInvitation.deleteMany({ where: { organizationId } });
      await setupDb.organizationConsentRecord.deleteMany({ where: { organizationId } });
      await setupDb.organizerOnboarding.deleteMany({ where: { organizationId } });
      await setupDb.organization.deleteMany({ where: { id: organizationId } });
    }
    await setupDb.auditLog.deleteMany({ where: { actorId: { in: [ownerId, staffId, outsiderId].filter(Boolean) } } });
    await setupDb.user.deleteMany({ where: { email: { in: [ownerEmail, staffEmail, outsiderEmail, expiredEmail] } } });
    await db.$disconnect(); await owner?.$disconnect();
  });

  it("registers inactive, verifies once, and prevents token replay", async () => {
    const registration = await registerOrganizer({ name: "Owner Test", email: ownerEmail, password: "Strong!Password1", website: "" });
    expect(registration.token).toBeTruthy();
    const before = await setupDb.user.findUniqueOrThrow({ where: { email: ownerEmail } }); ownerId = before.id;
    expect(before.isActive).toBe(false); expect(before.emailVerifiedAt).toBeNull();
    await verifyEmail({ token: registration.token });
    expect((await setupDb.user.findUniqueOrThrow({ where: { id: ownerId } })).emailVerifiedAt).toBeInstanceOf(Date);
    await expect(verifyEmail({ token: registration.token })).rejects.toMatchObject({ status: 400 });
  });

  it("provisions atomically and returns one result for concurrent retries", async () => {
    const idempotencyKey = crypto.randomUUID();
    const input = { organizationName: `Liga Phase 13 ${suffix}`, slug: `liga-phase13-${suffix}`, organizerType: "COMMUNITY", region: "Jawa Barat", contactEmail: ownerEmail, termsAccepted: true, privacyAccepted: true, termsVersion: "2026-10-12", privacyVersion: "2026-10-12", idempotencyKey };
    const [first, second] = await Promise.all([provisionOrganization(actor(ownerId), input), provisionOrganization(actor(ownerId), input)]);
    expect(first.id).toBe(second.id); organizationId = first.id;
    expect(await setupDb.organizationMember.count({ where: { organizationId, userId: ownerId } })).toBe(1);
    expect(await setupDb.organizationConsentRecord.count({ where: { organizationId, userId: ownerId } })).toBe(1);
  });

  it("rejects an expired verification token", async () => {
    const registration = await registerOrganizer({ name: "Expired Test", email: expiredEmail, password: "Strong!Password1", website: "" });
    expect(registration.token).toBeTruthy();
    await setupDb.emailVerificationToken.update({ where: { tokenHash: tokenDigest(registration.token!) }, data: { expiresAt: new Date(Date.now() - 1_000) } });
    await expect(verifyEmail({ token: registration.token })).rejects.toMatchObject({ status: 400 });
  });

  it("blocks owner escalation and cross-identity acceptance, then consumes once", async () => {
    const roles = await setupDb.role.findMany({ where: { organizationId } });
    const ownerRole = roles.find((role) => role.key === "organization-owner")!;
    const viewerRole = roles.find((role) => role.key === "viewer")!;
    await expect(createInvitation(actor(ownerId), organizationId, { email: staffEmail, roleId: ownerRole.id })).rejects.toMatchObject({ status: 403 });
    const issued = await createInvitation(actor(ownerId), organizationId, { email: staffEmail, roleId: viewerRole.id });
    await expect(respondToInvitation(actor(outsiderId), { token: issued.token }, "accept")).rejects.toMatchObject({ status: 400 });
    await expect(respondToInvitation(actor(staffId), { token: issued.token }, "accept")).resolves.toMatchObject({ status: "ACCEPTED", organizationId });
    await expect(respondToInvitation(actor(staffId), { token: issued.token }, "accept")).rejects.toMatchObject({ status: 400 });
    expect(await setupDb.organizationMember.count({ where: { organizationId, userId: staffId, roleId: viewerRole.id } })).toBe(1);
  });
});
