-- New organizations created after the Phase 17 backfill may create exactly one
-- pending verification row inside their own tenant context.
CREATE POLICY phase17_verification_tenant_create ON "OrganizerVerification" FOR INSERT
WITH CHECK (
  "organizationId"=NULLIF(current_setting('app.current_organization_id',true),'')
  AND status='PENDING_REVIEW' AND "reviewedById" IS NULL AND "reviewedAt" IS NULL
);
