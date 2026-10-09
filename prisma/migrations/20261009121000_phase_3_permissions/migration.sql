INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_phase3_fixture_view', 'fixture.view', 'View fixtures and fixture drafts'),
  ('perm_phase3_fixture_generate', 'fixture.generate', 'Generate fixture previews'),
  ('perm_phase3_fixture_create', 'fixture.create', 'Create fixtures manually'),
  ('perm_phase3_fixture_update', 'fixture.update', 'Update fixture details'),
  ('perm_phase3_fixture_publish', 'fixture.publish', 'Publish validated fixtures'),
  ('perm_phase3_fixture_reschedule', 'fixture.reschedule', 'Reschedule published fixtures'),
  ('perm_phase3_fixture_cancel', 'fixture.cancel', 'Cancel fixtures'),
  ('perm_phase3_group_view', 'group.view', 'View competition groups'),
  ('perm_phase3_group_manage', 'group.manage', 'Manage competition groups'),
  ('perm_phase3_bracket_view', 'bracket.view', 'View tournament brackets'),
  ('perm_phase3_bracket_manage', 'bracket.manage', 'Manage tournament brackets'),
  ('perm_phase3_schedule_view', 'schedule.view', 'View competition schedules'),
  ('perm_phase3_schedule_manage', 'schedule.manage', 'Manage competition schedules')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id" FROM "Role" role CROSS JOIN "Permission" permission
WHERE role."key" = 'organization-owner' AND permission."key" IN (
  'fixture.view', 'fixture.generate', 'fixture.create', 'fixture.update', 'fixture.publish', 'fixture.reschedule', 'fixture.cancel',
  'group.view', 'group.manage', 'bracket.view', 'bracket.manage', 'schedule.view', 'schedule.manage'
) ON CONFLICT ("roleId", "permissionId") DO NOTHING;
