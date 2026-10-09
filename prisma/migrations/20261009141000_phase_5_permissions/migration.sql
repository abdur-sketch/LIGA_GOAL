INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_standings_view', 'standings.view', 'View official standings'),
  ('perm_standings_recompute', 'standings.recompute', 'Recompute official standings'),
  ('perm_standings_adjust', 'standings.adjust', 'Authorize point adjustments'),
  ('perm_statistics_view', 'statistics.view', 'View team and player statistics'),
  ('perm_statistics_recompute', 'statistics.recompute', 'Recompute team and player statistics'),
  ('perm_statistics_export', 'statistics.export', 'Export official statistics'),
  ('perm_leaderboard_view', 'leaderboard.view', 'View official leaderboards')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('organization-owner', 'owner', 'e2e-owner')
  AND (
    p."key" LIKE 'standings.%'
    OR p."key" LIKE 'statistics.%'
    OR p."key" = 'leaderboard.view'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
