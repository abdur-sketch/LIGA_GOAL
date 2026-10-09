INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_match_view', 'match.view', 'View match center'),
  ('perm_match_lineup_manage', 'match.lineup.manage', 'Manage match lineups'),
  ('perm_match_lineup_confirm', 'match.lineup.confirm', 'Confirm match lineups'),
  ('perm_match_operate', 'match.operate', 'Operate live matches'),
  ('perm_match_event_correct', 'match.event.correct', 'Correct match events'),
  ('perm_match_finish', 'match.finish', 'Finish matches'),
  ('perm_match_review', 'match.review', 'Review match results'),
  ('perm_match_approve', 'match.approve', 'Approve official match results'),
  ('perm_match_official_correct', 'match.official.correct', 'Correct official match results'),
  ('perm_match_realtime_publish', 'match.realtime.publish', 'Publish realtime match state')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."key" IN ('organization-owner', 'owner', 'e2e-owner')
  AND p."key" LIKE 'match.%'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
