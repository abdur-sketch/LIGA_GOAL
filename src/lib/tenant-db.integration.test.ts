import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getEffectivePermissions } from "@/lib/auth/permissions";
import {
  withIdentityDatabase,
  withJobDatabase,
  withMembershipDatabase,
  withPublicDatabase,
  withTenantDatabase,
  withTenantDatabaseRetry,
} from "./tenant-db";

const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const runtime = runtimeUrl
  ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } })
  : null;
const suffix = Date.now().toString(36);
let tenantA = "";
let tenantB = "";
let identityUserId = "";
let permissionId = "";

describe.skipIf(!runtime)("PostgreSQL RLS runtime role", () => {
  beforeAll(async () => {
    const [a, b] = await Promise.all([
      db.organization.create({
        data: {
          name: "RLS Tenant A",
          slug: `rls-a-${suffix}`,
          status: "ACTIVE",
        },
      }),
      db.organization.create({
        data: {
          name: "RLS Tenant B",
          slug: `rls-b-${suffix}`,
          status: "ACTIVE",
        },
      }),
    ]);
    tenantA = a.id;
    tenantB = b.id;
    identityUserId = (
      await db.user.create({
        data: {
          name: "RLS Identity",
          email: `rls-identity-${suffix}@test.invalid`,
          passwordHash: "test",
        },
      })
    ).id;
    const permission = await db.permission.create({
      data: {
        key: `phase11.test.${suffix}`,
        description: "Phase 11 tenant permission isolation",
      },
    });
    permissionId = permission.id;
    const role = await db.role.create({
      data: {
        organizationId: tenantA,
        name: "Phase 11 Runtime Role",
        key: `phase11-${suffix}`,
        permissions: { create: { permissionId } },
      },
    });
    await db.organizationMember.create({
      data: {
        organizationId: tenantA,
        userId: identityUserId,
        roleId: role.id,
      },
    });
    await db.club.createMany({
      data: [
        {
          organizationId: tenantA,
          name: "A Club",
          shortName: "A",
          slug: `a-${suffix}`,
        },
        {
          organizationId: tenantB,
          name: "B Club",
          shortName: "B",
          slug: `b-${suffix}`,
        },
      ],
    });
  });
  afterAll(async () => {
    await runtime?.$disconnect();
    await db.auditLog.deleteMany({ where: { actorId: identityUserId } });
    await db.club.deleteMany({
      where: { organizationId: { in: [tenantA, tenantB] } },
    });
    await db.organization.deleteMany({
      where: { id: { in: [tenantA, tenantB] } },
    });
    await db.user.delete({ where: { id: identityUserId } });
    await db.permission.delete({ where: { id: permissionId } });
  });

  it("default-denies queries without transaction context", async () => {
    expect(await runtime!.organization.count()).toBe(0);
    expect(
      await runtime!.$queryRaw<
        Array<{ count: bigint }>
      >`SELECT count(*)::bigint AS count FROM "Club"`,
    ).toEqual([{ count: BigInt(0) }]);
  });
  it("allows tenant A while hiding tenant B through Prisma and raw SQL", async () => {
    await withTenantDatabase(runtime!, tenantA, async (tx) => {
      expect((await tx.organization.findMany()).map((row) => row.id)).toEqual([
        tenantA,
      ]);
      expect(
        (await tx.club.findMany()).map((row) => row.organizationId),
      ).toEqual([tenantA]);
      const rows = await tx.$queryRaw<
        Array<{ organizationId: string }>
      >`SELECT "organizationId" FROM "Club"`;
      expect(rows.every((row) => row.organizationId === tenantA)).toBe(true);
      await expect(
        tx.club.create({
          data: {
            organizationId: tenantB,
            name: "Cross Tenant",
            shortName: "X",
            slug: `x-${suffix}`,
          },
        }),
      ).rejects.toBeTruthy();
    });
  });

  it("routes nested DAL calls through the contextual transaction without leaking pooled context", async () => {
    const [visibleA, visibleB] = await Promise.all([
      withTenantDatabase(runtime!, tenantA, async () => {
        const rows = await db.club.findMany();
        const nested = await db.$transaction(async () =>
          db.organization.findMany(),
        );
        return {
          clubs: rows.map((row) => row.organizationId),
          organizations: nested.map((row) => row.id),
        };
      }),
      withTenantDatabase(runtime!, tenantB, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return db.club.findMany({ select: { organizationId: true } });
      }),
    ]);
    expect(visibleA.clubs).toEqual([tenantA]);
    expect(visibleA.organizations).toEqual([tenantA]);
    expect(visibleB.map((row) => row.organizationId)).toEqual([tenantB]);
    expect(await runtime!.club.count()).toBe(0);
  });

  it("clears context after rollback and rejects invalid context", async () => {
    await expect(
      withTenantDatabase(runtime!, tenantA, async () => {
        expect(await db.club.count()).toBe(1);
        throw new Error("synthetic rollback");
      }),
    ).rejects.toThrow("synthetic rollback");
    expect(await runtime!.club.count()).toBe(0);
    await expect(
      withTenantDatabase(runtime!, "../tenant-b", async () => db.club.count()),
    ).rejects.toThrow("Tenant context tidak valid");
  });

  it("clears context after transaction timeout", async () => {
    await expect(
      withTenantDatabase(
        runtime!,
        tenantA,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 60));
          return db.club.count();
        },
        { timeout: 20 },
      ),
    ).rejects.toBeTruthy();
    expect(await runtime!.club.count()).toBe(0);
  });

  it("uses explicit job/public scopes without leaking their pooled context", async () => {
    expect(
      await withJobDatabase(tenantA, () => db.club.count(), runtime!),
    ).toBe(1);
    expect(
      await withPublicDatabase(() => db.club.count(), runtime!),
    ).toBeGreaterThanOrEqual(2);
    expect(await runtime!.club.count()).toBe(0);
  });

  it("allows global identity work without opening a tenant-data bypass", async () => {
    const result = await withIdentityDatabase(async () => {
      const user = await db.user.findUniqueOrThrow({
        where: { id: identityUserId },
      });
      const audit = await db.auditLog.createMany({
        data: [
          {
            actorId: user.id,
            action: "LOGIN",
            resourceType: "SESSION",
            resourceId: user.id,
          },
        ],
      });
      return {
        userId: user.id,
        auditCreated: audit.count,
        clubs: await db.club.count(),
        organizations: await db.organization.count(),
      };
    }, runtime!);
    expect(result).toMatchObject({
      userId: identityUserId,
      auditCreated: 1,
      clubs: 0,
      organizations: 0,
    });
    expect(await runtime!.club.count()).toBe(0);
  });

  it("evaluates membership and permissions only inside the selected tenant", async () => {
    const allowed = await withTenantDatabase(runtime!, tenantA, () =>
      getEffectivePermissions(identityUserId, tenantA),
    );
    const denied = await withTenantDatabase(runtime!, tenantB, () =>
      getEffectivePermissions(identityUserId, tenantB),
    );
    expect([...allowed]).toEqual([`phase11.test.${suffix}`]);
    expect([...denied]).toEqual([]);
  });

  it("discovers only the current identity's active organization membership", async () => {
    const organizations = await withMembershipDatabase(
      identityUserId,
      () => db.organization.findMany({ select: { id: true } }),
      runtime!,
    );
    expect(organizations).toEqual([{ id: tenantA }]);
    expect(await runtime!.organization.count()).toBe(0);
  });

  it("retries only the opt-in idempotent transaction on Prisma P2034", async () => {
    let attempts = 0;
    const count = await withTenantDatabaseRetry(
      runtime!,
      tenantA,
      async (_tx, attempt) => {
        attempts = attempt;
        if (attempt === 1)
          throw new (
            await import("@prisma/client/runtime/library")
          ).PrismaClientKnownRequestError("synthetic conflict", {
            code: "P2034",
            clientVersion: "6.12.0",
          });
        return db.club.count();
      },
    );
    expect({ attempts, count }).toEqual({ attempts: 2, count: 1 });
    expect(await runtime!.club.count()).toBe(0);
  });
});
