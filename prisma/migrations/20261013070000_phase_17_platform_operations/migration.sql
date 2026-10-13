-- Phase 17: additive platform operations, verification, and abuse moderation.
CREATE TYPE "OrganizerVerificationStatus" AS ENUM ('UNVERIFIED','PENDING_REVIEW','VERIFIED','REJECTED','SUSPENDED');
CREATE TYPE "ModerationTargetType" AS ENUM ('ORGANIZER','COMPETITION');
CREATE TYPE "AbuseReportStatus" AS ENUM ('OPEN','IN_REVIEW','ACTIONED','DISMISSED');
CREATE TYPE "ModerationAppealStatus" AS ENUM ('PENDING','UPHELD','OVERTURNED','WITHDRAWN');

CREATE TABLE "OrganizerVerification" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL UNIQUE REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status "OrganizerVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  evidence JSONB NOT NULL DEFAULT '{}',
  "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "reviewedById" TEXT,
  "reviewReason" TEXT, version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizerVerification_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "OrganizerVerification_status_submittedAt_id_idx" ON "OrganizerVerification"(status,"submittedAt",id);

CREATE TABLE "AbuseReport" (
  id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "competitionId" TEXT,
  "targetType" "ModerationTargetType" NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  "reporterContact" TEXT, "sourceHash" TEXT NOT NULL,
  status "AbuseReportStatus" NOT NULL DEFAULT 'OPEN', "assignedToId" TEXT,
  resolution TEXT, version INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "AbuseReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AbuseReport_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AbuseReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AbuseReport_target_shape_check" CHECK (("targetType"='ORGANIZER' AND "competitionId" IS NULL) OR ("targetType"='COMPETITION' AND "competitionId" IS NOT NULL)),
  CONSTRAINT "AbuseReport_source_hash_check" CHECK (length("sourceHash")=64)
);
CREATE INDEX "AbuseReport_status_createdAt_id_idx" ON "AbuseReport"(status,"createdAt",id);
CREATE INDEX "AbuseReport_organizationId_targetType_createdAt_idx" ON "AbuseReport"("organizationId","targetType","createdAt");
CREATE INDEX "AbuseReport_competitionId_createdAt_idx" ON "AbuseReport"("competitionId","createdAt");

CREATE TABLE "ModerationNote" (
  id TEXT PRIMARY KEY, "reportId" TEXT NOT NULL REFERENCES "AbuseReport"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  body TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ModerationNote_reportId_createdAt_idx" ON "ModerationNote"("reportId","createdAt");

CREATE TABLE "ModerationAppeal" (
  id TEXT PRIMARY KEY, "reportId" TEXT NOT NULL REFERENCES "AbuseReport"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  reason TEXT NOT NULL, status "ModerationAppealStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE,
  "reviewReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ModerationAppeal_reportId_organizationId_key" UNIQUE ("reportId","organizationId")
);
CREATE INDEX "ModerationAppeal_status_createdAt_id_idx" ON "ModerationAppeal"(status,"createdAt",id);

CREATE OR REPLACE FUNCTION public.phase17_validate_abuse_target() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."competitionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Competition" c WHERE c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId" AND c."deletedAt" IS NULL
  ) THEN RAISE EXCEPTION 'competition target does not belong to organization'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase17_abuse_target_guard BEFORE INSERT OR UPDATE OF "organizationId","competitionId" ON "AbuseReport" FOR EACH ROW EXECUTE FUNCTION public.phase17_validate_abuse_target();

INSERT INTO "OrganizerVerification" (id,"organizationId",status,"updatedAt")
SELECT 'phase17-verification-'||id,id,'UNVERIFIED',CURRENT_TIMESTAMP FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "PlatformPermissionGrant" (id,"userId",permission,"grantedById",reason)
SELECT 'phase17-'||replace(p.permission,'.','-')||'-'||u.id,u.id,p.permission,u.id,'PHASE_17_PLATFORM_OPERATIONS_BACKFILL'
FROM "User" u CROSS JOIN (VALUES
 ('platform.operations.view'),('platform.organizations.manage'),('platform.users.view'),('platform.audit.view'),
 ('organizer.verification.view'),('organizer.verification.manage'),('abuse.moderate.view'),('abuse.moderate.manage')
) AS p(permission) WHERE u."isPlatformAdmin"=true ON CONFLICT DO NOTHING;

ALTER TABLE "OrganizerVerification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase17_verification_tenant_read ON "OrganizerVerification" FOR SELECT USING ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),''));
CREATE POLICY phase17_verification_tenant_submit ON "OrganizerVerification" FOR UPDATE
  USING ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),'') AND status IN ('UNVERIFIED','REJECTED'))
  WITH CHECK ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),'') AND status='PENDING_REVIEW');
CREATE POLICY phase17_verification_platform ON "OrganizerVerification" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');

ALTER TABLE "AbuseReport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase17_abuse_public_submit ON "AbuseReport" FOR INSERT WITH CHECK (
  current_setting('app.access_mode',true)='public' AND status='OPEN' AND "assignedToId" IS NULL AND resolution IS NULL AND "resolvedAt" IS NULL
);
CREATE POLICY phase17_abuse_tenant_read ON "AbuseReport" FOR SELECT USING ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),''));
CREATE POLICY phase17_abuse_platform ON "AbuseReport" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');

ALTER TABLE "ModerationNote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase17_notes_platform ON "ModerationNote" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');

ALTER TABLE "ModerationAppeal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase17_appeal_tenant_read ON "ModerationAppeal" FOR SELECT USING ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),''));
CREATE POLICY phase17_appeal_tenant_insert ON "ModerationAppeal" FOR INSERT WITH CHECK ("organizationId"=NULLIF(current_setting('app.current_organization_id',true),'') AND status='PENDING' AND "reviewedById" IS NULL);
CREATE POLICY phase17_appeal_platform ON "ModerationAppeal" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');
