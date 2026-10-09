import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getEffectivePermissions } from "./permissions";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let userId: string;
let organizationId: string;
let otherOrganizationId: string;
let permissionId: string;

describe("tenant RBAC integration", () => {
  beforeAll(async () => {
    const permission = await db.permission.create({ data: { key: `test.club.view.${suffix}`, description: "Integration test permission" } });
    permissionId = permission.id;
    const organization = await db.organization.create({ data: { name: "Integration Tenant", slug: `integration-${suffix}`, status: "ACTIVE" } });
    organizationId = organization.id;
    const other = await db.organization.create({ data: { name: "Other Tenant", slug: `other-${suffix}`, status: "ACTIVE" } });
    otherOrganizationId = other.id;
    const role = await db.role.create({ data: { organizationId, name: "Test Admin", key: `test-admin-${suffix}`, permissions: { create: { permissionId } } } });
    const user = await db.user.create({ data: { email: `rbac-${suffix}@example.test`, name: "RBAC Test", passwordHash: "not-a-real-login-hash", memberships: { create: { organizationId, roleId: role.id } } } });
    userId = user.id;
  });

  afterAll(async () => {
    await db.userPermission.deleteMany({ where: { userId } });
    await db.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await db.user.delete({ where: { id: userId } });
    await db.permission.delete({ where: { id: permissionId } });
    await db.$disconnect();
  });

  it("resolves role grants only inside the active tenant", async () => {
    expect(await getEffectivePermissions(userId, organizationId)).toContain(`test.club.view.${suffix}`);
    expect(await getEffectivePermissions(userId, otherOrganizationId)).toHaveLength(0);
  });

  it("lets an explicit deny override a role grant", async () => {
    await db.userPermission.create({ data: { userId, organizationId, permissionId, allowed: false } });
    expect(await getEffectivePermissions(userId, organizationId)).not.toContain(`test.club.view.${suffix}`);
  });
});
