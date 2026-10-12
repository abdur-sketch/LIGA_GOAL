-- Phase 11: identity operations are global only for the non-tenant identity
-- tables. They do not receive app.platform_admin and therefore cannot read or
-- write tenant data. Authentication may append only organization-less audit
-- events while running in the explicit identity scope.

CREATE POLICY identity_global_audit_insert ON public."AuditLog"
  FOR INSERT
  WITH CHECK (
    "organizationId" IS NULL
    AND current_setting('app.access_mode', true) = 'identity'
    AND current_setting('app.platform_admin', true) <> 'true'
  );
