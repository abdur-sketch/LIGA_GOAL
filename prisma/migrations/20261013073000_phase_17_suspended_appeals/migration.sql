-- Suspended tenants retain one narrowly scoped right: submit an appeal.
INSERT INTO "Permission" (id,key,description) VALUES
('phase17_moderation_appeal','organization.moderation.appeal','Mengajukan appeal atas tindakan moderasi organisasi')
ON CONFLICT (key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key IN ('organization-owner','e2e-owner') AND p.key='organization.moderation.appeal'
ON CONFLICT DO NOTHING;
