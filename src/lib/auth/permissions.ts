import { db } from "@/lib/db";

export type PermissionKey =
  | "organization.view"
  | "organization.create"
  | "organization.update"
  | "organization.manage_members"
  | "competition.view"
  | "competition.create"
  | "competition.update"
  | "competition.delete"
  | "season.view"
  | "season.create"
  | "season.update"
  | "season.delete"
  | "club.view"
  | "club.create"
  | "club.update"
  | "club.verify"
  | "venue.view"
  | "venue.create"
  | "venue.update"
  | "venue.delete"
  | "official.view"
  | "official.create"
  | "official.update"
  | "official.delete"
  | "player.view"
  | "player.create"
  | "player.update"
  | "player.archive"
  | "player.verify"
  | "registration.view"
  | "registration.create"
  | "registration.submit"
  | "registration.verify"
  | "registration.approve"
  | "registration.reject"
  | "squad.view"
  | "squad.manage"
  | "player_document.view"
  | "player_document.upload"
  | "player_document.verify"
  | "fixture.view"
  | "fixture.generate"
  | "fixture.create"
  | "fixture.update"
  | "fixture.publish"
  | "fixture.reschedule"
  | "fixture.cancel"
  | "group.view"
  | "group.manage"
  | "bracket.view"
  | "bracket.manage"
  | "schedule.view"
  | "schedule.manage"
  | "match.view"
  | "match.lineup.manage"
  | "match.lineup.confirm"
  | "match.operate"
  | "match.event.correct"
  | "match.finish"
  | "match.review"
  | "match.approve"
  | "match.official.correct"
  | "match.realtime.publish"
  | "match.correct"
  | "standings.view"
  | "standings.recompute"
  | "standings.adjust"
  | "statistics.view"
  | "statistics.recompute"
  | "statistics.export"
  | "leaderboard.view"
  | "transfer.view"
  | "transfer.request"
  | "transfer.review"
  | "transfer.approve"
  | "transfer.cancel"
  | "transfer_window.view"
  | "transfer_window.manage"
  | "availability.view"
  | "availability.manage"
  | "injury.view"
  | "injury.manage"
  | "injury.clearance"
  | "discipline.view"
  | "discipline.manage"
  | "discipline.approve"
  | "discipline.appeal"
  | "suspension.view"
  | "suspension.manage"
  | "article.view"
  | "article.create"
  | "article.update"
  | "article.publish"
  | "article.archive"
  | "notification.view"
  | "notification.manage"
  | "notification.send"
  | "report.view"
  | "report.export"
  | "user.manage"
  | "permission.manage"
  | "audit.view";

export async function getEffectivePermissions(
  userId: string,
  organizationId: string,
) {
  const membership = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: {
      isActive: true,
      organization: { select: { status: true, deletedAt: true } },
      role: {
        select: {
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (
    !membership?.isActive ||
    membership.organization.status !== "ACTIVE" ||
    membership.organization.deletedAt
  ) {
    return new Set<string>();
  }

  const permissions = new Set(
    membership.role.permissions.map((link) => link.permission.key),
  );
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

export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: PermissionKey,
) {
  return (await getEffectivePermissions(userId, organizationId)).has(
    permission,
  );
}
