-- Register Phase 6 permissions and grant them to existing owner roles.
INSERT INTO "Permission" ("id", "key", "description") VALUES
  ('perm_transfer_view', 'transfer.view', 'Melihat transfer'),
  ('perm_transfer_request', 'transfer.request', 'Membuat dan mengajukan transfer'),
  ('perm_transfer_review', 'transfer.review', 'Meninjau transfer'),
  ('perm_transfer_approve', 'transfer.approve', 'Menyetujui dan menyelesaikan transfer'),
  ('perm_transfer_cancel', 'transfer.cancel', 'Membatalkan transfer'),
  ('perm_transfer_window_view', 'transfer_window.view', 'Melihat jendela transfer'),
  ('perm_transfer_window_manage', 'transfer_window.manage', 'Mengelola jendela transfer'),
  ('perm_availability_view', 'availability.view', 'Melihat availability pemain'),
  ('perm_availability_manage', 'availability.manage', 'Mengelola availability pemain'),
  ('perm_injury_view', 'injury.view', 'Melihat data cedera'),
  ('perm_injury_manage', 'injury.manage', 'Mengelola data cedera'),
  ('perm_injury_clearance', 'injury.clearance', 'Menerbitkan medical clearance'),
  ('perm_discipline_view', 'discipline.view', 'Melihat perkara disiplin'),
  ('perm_discipline_manage', 'discipline.manage', 'Mengelola perkara disiplin'),
  ('perm_discipline_approve', 'discipline.approve', 'Mengesahkan keputusan disiplin'),
  ('perm_discipline_appeal', 'discipline.appeal', 'Mengajukan banding disiplin'),
  ('perm_suspension_view', 'suspension.view', 'Melihat suspensi'),
  ('perm_suspension_manage', 'suspension.manage', 'Mengelola suspensi')
ON CONFLICT ("key") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role."id", permission."id"
FROM "Role" role
JOIN "Permission" permission ON permission."key" IN (
  'transfer.view', 'transfer.request', 'transfer.review', 'transfer.approve', 'transfer.cancel',
  'transfer_window.view', 'transfer_window.manage', 'availability.view', 'availability.manage',
  'injury.view', 'injury.manage', 'injury.clearance', 'discipline.view', 'discipline.manage',
  'discipline.approve', 'discipline.appeal', 'suspension.view', 'suspension.manage'
)
WHERE role."key" IN ('organization-owner', 'owner', 'e2e-owner')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
