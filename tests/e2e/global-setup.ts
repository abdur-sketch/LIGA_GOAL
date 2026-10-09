import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const permissions = ["organization.view", "organization.update", "organization.manage_members", "competition.view", "competition.create", "competition.update", "competition.delete", "season.view", "season.create", "season.update", "season.delete", "club.view", "club.create", "club.update", "club.verify", "venue.view", "venue.create", "venue.update", "venue.delete", "official.view", "official.create", "official.update", "official.delete", "audit.view"];

export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    const user = await db.user.upsert({ where: { email: "e2e-admin@ligagoal.test" }, update: { passwordHash: await hash("E2E-password-123!", 10), isActive: true, isPlatformAdmin: true }, create: { name: "E2E Admin", email: "e2e-admin@ligagoal.test", passwordHash: await hash("E2E-password-123!", 10), isPlatformAdmin: true } });
    const organization = await db.organization.upsert({ where: { slug: "e2e-liga-goal" }, update: { status: "ACTIVE", deletedAt: null, ownerId: user.id }, create: { name: "E2E Liga Goal", slug: "e2e-liga-goal", status: "ACTIVE", ownerId: user.id } });
    const role = await db.role.upsert({ where: { organizationId_key: { organizationId: organization.id, key: "e2e-owner" } }, update: {}, create: { organizationId: organization.id, name: "E2E Owner", key: "e2e-owner", isSystem: true } });
    for (const key of permissions) {
      const permission = await db.permission.upsert({ where: { key }, update: {}, create: { key, description: key } });
      await db.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
    }
    await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: organization.id, userId: user.id } }, update: { roleId: role.id, isActive: true }, create: { organizationId: organization.id, userId: user.id, roleId: role.id } });
  } finally { await db.$disconnect(); }
}
