import { db } from "@/lib/db";

export type PermissionKey =
  | "organization.view" | "organization.create" | "organization.update" | "organization.manage_members"
  | "competition.view" | "competition.create" | "competition.update" | "competition.delete"
  | "season.view" | "season.create" | "season.update" | "season.delete"
  | "club.view" | "club.create" | "club.update" | "club.verify"
  | "venue.view" | "venue.create" | "venue.update" | "venue.delete"
  | "official.view" | "official.create" | "official.update" | "official.delete"
  | "player.view" | "player.create" | "player.update" | "player.verify"
  | "fixture.view" | "fixture.create" | "fixture.update" | "fixture.publish"
  | "match.view" | "match.operate" | "match.approve" | "match.correct"
  | "transfer.view" | "transfer.request" | "transfer.approve"
  | "injury.view" | "injury.manage" | "discipline.view" | "discipline.manage"
  | "report.view" | "report.export" | "user.manage" | "permission.manage" | "audit.view";

export async function getEffectivePermissions(userId: string, organizationId: string) {
  const membership = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      isActive: true,
      organization: { select: { status: true, deletedAt: true } },
      role: { select: { permissions: { select: { permission: { select: { key: true } } } } } },
    },
  });

  if (!membership?.isActive || membership.organization.status !== "ACTIVE" || membership.organization.deletedAt) {
    return new Set<string>();
  }

  const permissions = new Set(membership.role.permissions.map((link) => link.permission.key));
  const overrides = await db.userPermission.findMany({
    where: { userId, organizationId },
    select: { allowed: true, permission: { select: { key: true } } },
  });
  for (const override of overrides) {
    if (override.allowed) permissions.add(override.permission.key);
    else permissions.delete(override.permission.key);
  }
  return permissions;
}

export async function hasPermission(userId: string, organizationId: string, permission: PermissionKey) {
  return (await getEffectivePermissions(userId, organizationId)).has(permission);
}
