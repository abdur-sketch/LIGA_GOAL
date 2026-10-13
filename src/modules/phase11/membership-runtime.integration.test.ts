import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rootDb } from "@/lib/db";
import { listOrganizations } from "@/modules/phase1/service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const enabled = process.env.PHASE11_RUNTIME_IDENTITY_TEST === "1" && ownerUrl;
const owner = ownerUrl
  ? new PrismaClient({ datasources: { db: { url: ownerUrl } } })
  : null;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let userId = "";
let organizationA = "";
let organizationB = "";

describe.skipIf(!enabled)(
  "Phase 11 least-privilege membership discovery",
  () => {
    beforeAll(async () => {
      const user = await owner!.user.create({
        data: {
          name: "Phase 11 Membership User",
          email: `phase11-membership-${suffix}@test.invalid`,
          passwordHash: "test",
        },
      });
      userId = user.id;
      const [a, b] = await Promise.all([
        owner!.organization.create({
          data: {
            name: "Phase 11 Visible Organization",
            slug: `phase11-visible-${suffix}`,
            status: "ACTIVE",
          },
        }),
        owner!.organization.create({
          data: {
            name: "Phase 11 Hidden Organization",
            slug: `phase11-hidden-${suffix}`,
            status: "ACTIVE",
          },
        }),
      ]);
      organizationA = a.id;
      organizationB = b.id;
      const role = await owner!.role.create({
        data: {
          organizationId: organizationA,
          name: "Viewer",
          key: `viewer-${suffix}`,
        },
      });
      await owner!.organizationMember.create({
        data: { organizationId: organizationA, userId, roleId: role.id },
      });
      await owner!.club.create({
        data: {
          organizationId: organizationA,
          name: "Visible Club",
          shortName: "VIS",
          slug: `visible-club-${suffix}`,
        },
      });
    });

    afterAll(async () => {
      await rootDb.$disconnect();
      await owner!.club.deleteMany({
        where: { organizationId: { in: [organizationA, organizationB] } },
      });
      await owner!.organizationMember.deleteMany({
        where: { organizationId: { in: [organizationA, organizationB] } },
      });
      await owner!.role.deleteMany({
        where: { organizationId: { in: [organizationA, organizationB] } },
      });
      await owner!.organization.deleteMany({
        where: { id: { in: [organizationA, organizationB] } },
      });
      await owner!.user.delete({ where: { id: userId } });
      await owner!.$disconnect();
    });

    it("returns the member organization with tenant-derived counts only", async () => {
      const result = await listOrganizations(
        {
          id: userId,
          isActive: true,
          isPlatformAdmin: false,
          deletedAt: null,
        },
        { search: "", page: 1, pageSize: 20 },
      );
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: organizationA,
        _count: { memberships: 1, clubs: 1, competitions: 0 },
      });
      expect(result.data.some((item) => item.id === organizationB)).toBe(false);
    });

    it("lists platform organizations in one audited platform scope", async () => {
      const result = await listOrganizations(
        { id: userId, isActive: true, isPlatformAdmin: true, deletedAt: null },
        { search: suffix, page: 1, pageSize: 20 },
      );
      expect(result.meta.total).toBe(2);
      expect(result.data.map((item) => item.id).sort()).toEqual([organizationA, organizationB].sort());
      expect(result.data.every((item) => item._canUpdate)).toBe(true);
    });
  },
);
