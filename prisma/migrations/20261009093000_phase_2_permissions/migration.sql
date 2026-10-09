-- Register Phase 2 permissions and grant them to existing organization-owner roles.
INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_phase2_player_view', 'player.view', 'View player profiles'),
  ('perm_phase2_player_create', 'player.create', 'Create player profiles'),
  ('perm_phase2_player_update', 'player.update', 'Update player profiles'),
  ('perm_phase2_player_archive', 'player.archive', 'Archive player profiles'),
  ('perm_phase2_registration_view', 'registration.view', 'View player registrations'),
  ('perm_phase2_registration_create', 'registration.create', 'Create player registrations'),
  ('perm_phase2_registration_submit', 'registration.submit', 'Submit player registrations'),
  ('perm_phase2_registration_verify', 'registration.verify', 'Verify player registrations'),
  ('perm_phase2_registration_approve', 'registration.approve', 'Approve player registrations'),
  ('perm_phase2_registration_reject', 'registration.reject', 'Reject player registrations'),
  ('perm_phase2_squad_view', 'squad.view', 'View squad rosters'),
  ('perm_phase2_squad_manage', 'squad.manage', 'Manage squad rosters'),
  ('perm_phase2_player_document_view', 'player_document.view', 'View private player documents'),
  ('perm_phase2_player_document_upload', 'player_document.upload', 'Upload private player documents'),
  ('perm_phase2_player_document_verify', 'player_document.verify', 'Verify private player documents')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role."key" = 'organization-owner'
  AND permission."key" IN (
    'player.view', 'player.create', 'player.update', 'player.archive',
    'registration.view', 'registration.create', 'registration.submit', 'registration.verify', 'registration.approve', 'registration.reject',
    'squad.view', 'squad.manage',
    'player_document.view', 'player_document.upload', 'player_document.verify'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
