import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/auth/api";
import { createOrganization, createResource, listResource, updateResource } from "./service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const platform = { id: "", isActive: true, isPlatformAdmin: true, deletedAt: null as Date | null };
const tenantBActor = { id: "", isActive: true, isPlatformAdmin: false, deletedAt: null as Date | null };
const organizationIds: string[] = []; const userIds: string[] = [];

describe("Phase 1 CRUD and tenant isolation", () => {
  it("creates the management hierarchy without duplicating club identity", async () => {
    const [admin, tenantB] = await Promise.all([
      db.user.create({ data: { name: "Platform Test", email: `platform-${suffix}@example.test`, passwordHash: "test", isPlatformAdmin: true } }),
      db.user.create({ data: { name: "Tenant B", email: `tenant-b-${suffix}@example.test`, passwordHash: "test" } }),
    ]);
    platform.id = admin.id; tenantBActor.id = tenantB.id; userIds.push(admin.id, tenantB.id);
    const organization = await createOrganization(platform, { name: "Tenant A", slug: `tenant-a-${suffix}`, status: "ACTIVE", ownerId: admin.id });
    const organizationB = await createOrganization(platform, { name: "Tenant B", slug: `tenant-b-${suffix}`, status: "ACTIVE", ownerId: tenantB.id });
    organizationIds.push(organization.id, organizationB.id);
    const competition = await createResource("competitions", platform, organization.id, { name: "Liga Test", slug: `liga-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "DRAFT" });
    const venue = await createResource("venues", platform, organization.id, { name: "Stadion Test", city: "Bandung", capacity: 1000, status: "AVAILABLE", timezone: "Asia/Jakarta" });
    const club = await createResource("clubs", platform, organization.id, { name: "Garuda Test", shortName: "GRT", slug: `garuda-${suffix}`, city: "Bandung", homeVenueId: venue.id, isActive: true });
    const season1 = await createResource("seasons", platform, organization.id, { competitionId: competition.id, name: "2026", startsAt: "2026-01-01", endsAt: "2026-06-30", status: "ACTIVE", isActive: true, winPoints: 3, drawPoints: 1, lossPoints: 0, tieBreakers: ["points", "goal_difference"] });
    const season2 = await createResource("seasons", platform, organization.id, { competitionId: competition.id, name: "2027", startsAt: "2027-01-01", endsAt: "2027-06-30", status: "DRAFT", isActive: false, winPoints: 3, drawPoints: 1, lossPoints: 0, tieBreakers: ["points"] });
    await createResource("participations", platform, organization.id, { competitionId: competition.id, seasonId: season1.id, clubId: club.id, status: "APPROVED" });
    await createResource("participations", platform, organization.id, { competitionId: competition.id, seasonId: season2.id, clubId: club.id, status: "PENDING" });
    const official = await createResource("officials", platform, organization.id, { fullName: "Pelatih Test", email: `coach-${suffix}@example.test`, isActive: true });
    await createResource("assignments", platform, organization.id, { officialId: official.id, seasonId: season1.id, clubId: club.id, role: "HEAD_COACH", startsAt: "2026-01-01" });
    await updateResource("competitions", competition.id, platform, organization.id, { name: "Liga Test Updated", slug: `liga-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "REGISTRATION" });
    expect(await db.club.count({ where: { id: club.id } })).toBe(1);
    expect(await db.competitionClub.count({ where: { clubId: club.id } })).toBe(2);
    expect(await db.auditLog.count({ where: { organizationId: organization.id } })).toBeGreaterThan(7);
  });

  it("blocks cross-tenant list and mutation attempts", async () => {
    await expect(listResource("clubs", tenantBActor, { organizationId: organizationIds[0], search: "", page: 1, pageSize: 10 })).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
    await expect(createResource("venues", tenantBActor, organizationIds[0], { name: "Intruder Field", status: "AVAILABLE", timezone: "Asia/Jakarta" })).rejects.toMatchObject({ status: 403 } satisfies Partial<ApiError>);
  });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.officialAssignment.deleteMany({ where: { official: { organizationId: { in: organizationIds } } } });
  await db.competitionClub.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.season.deleteMany({ where: { competition: { organizationId: { in: organizationIds } } } });
  await db.competition.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.official.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.club.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.venue.deleteMany({ where: { organizationId: { in: organizationIds } } });
  await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});
