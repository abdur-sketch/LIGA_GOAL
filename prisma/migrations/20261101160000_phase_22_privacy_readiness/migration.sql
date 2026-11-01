CREATE TYPE "PrivacyRequestType" AS ENUM ('ACCESS','CORRECTION','ERASURE');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('SUBMITTED','VERIFIED','IN_REVIEW','APPROVED','REJECTED','COMPLETED');

ALTER TABLE "PublicRegistration"
  ADD COLUMN "privacyVersion" TEXT NOT NULL DEFAULT 'legacy-phase21',
  ADD COLUMN "processingConsentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "processingContext" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "isMinor" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guardianName" TEXT,
  ADD COLUMN "guardianContact" TEXT,
  ADD COLUMN "guardianConsentAt" TIMESTAMP(3),
  ADD COLUMN "retentionUntil" TIMESTAMP(3),
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

ALTER TABLE "PublicRegistration" ADD CONSTRAINT phase22_minor_guardian_check CHECK (
  NOT "isMinor" OR ("guardianName" IS NOT NULL AND "guardianContact" IS NOT NULL AND "guardianConsentAt" IS NOT NULL)
);

CREATE TABLE "PrivacyDataRequest" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  type "PrivacyRequestType" NOT NULL,
  status "PrivacyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "requesterEmailHash" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  description TEXT,
  "verifiedAt" TIMESTAMP(3),
  "handledById" TEXT,
  "handledAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivacyDataRequest_pkey" PRIMARY KEY (id)
);

CREATE TABLE "SensitiveDataAccessLog" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  purpose TEXT NOT NULL,
  "fieldSet" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SensitiveDataAccessLog_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "PrivacyDataRequest_tokenHash_key" ON "PrivacyDataRequest"("tokenHash");
CREATE UNIQUE INDEX "PrivacyDataRequest_organizationId_idempotencyKey_key" ON "PrivacyDataRequest"("organizationId","idempotencyKey");
CREATE INDEX "PrivacyDataRequest_organizationId_status_createdAt_idx" ON "PrivacyDataRequest"("organizationId",status,"createdAt");
CREATE INDEX "PrivacyDataRequest_registrationId_createdAt_idx" ON "PrivacyDataRequest"("registrationId","createdAt");
CREATE INDEX "SensitiveDataAccessLog_organizationId_createdAt_idx" ON "SensitiveDataAccessLog"("organizationId","createdAt");
CREATE INDEX "SensitiveDataAccessLog_actorId_createdAt_idx" ON "SensitiveDataAccessLog"("actorId","createdAt");

ALTER TABLE "PrivacyDataRequest" ADD CONSTRAINT "PrivacyDataRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyDataRequest" ADD CONSTRAINT "PrivacyDataRequest_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PublicRegistration"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyDataRequest" ADD CONSTRAINT "PrivacyDataRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SensitiveDataAccessLog" ADD CONSTRAINT "SensitiveDataAccessLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SensitiveDataAccessLog" ADD CONSTRAINT "SensitiveDataAccessLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.phase22_validate_privacy_request_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "PublicRegistration" r WHERE r.id=NEW."registrationId" AND r."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'PRIVACY_REQUEST_TENANT_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase22_privacy_request_tenant BEFORE INSERT OR UPDATE ON "PrivacyDataRequest" FOR EACH ROW EXECUTE FUNCTION public.phase22_validate_privacy_request_tenant();

CREATE OR REPLACE FUNCTION public.phase22_validate_sensitive_access_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "OrganizationMember" m WHERE m."organizationId"=NEW."organizationId" AND m."userId"=NEW."actorId" AND m."isActive"=true) AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id=NEW."actorId" AND u."isPlatformAdmin"=true) THEN RAISE EXCEPTION 'SENSITIVE_ACCESS_ACTOR_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase22_sensitive_access_tenant BEFORE INSERT ON "SensitiveDataAccessLog" FOR EACH ROW EXECUTE FUNCTION public.phase22_validate_sensitive_access_tenant();

CREATE OR REPLACE FUNCTION public.phase22_immutable_sensitive_access() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SENSITIVE_ACCESS_LOG_IMMUTABLE'; END $$;
CREATE TRIGGER phase22_sensitive_access_immutable BEFORE UPDATE OR DELETE ON "SensitiveDataAccessLog" FOR EACH ROW EXECUTE FUNCTION public.phase22_immutable_sensitive_access();

ALTER TABLE "PrivacyDataRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase22_privacy_request_tenant ON "PrivacyDataRequest" FOR ALL USING (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId"));
ALTER TABLE "SensitiveDataAccessLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase22_sensitive_access_tenant ON "SensitiveDataAccessLog" FOR ALL USING (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId"));

REVOKE EXECUTE ON FUNCTION public.phase21_submit_public_registration(TEXT,TEXT,TEXT,"ParticipantType",TEXT,TEXT,TEXT,TEXT,TEXT,JSONB,JSONB,JSONB,TEXT,TEXT,TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.phase22_submit_public_registration(
  p_id TEXT,p_history_id TEXT,p_public_slug TEXT,p_participant_type "ParticipantType",p_registration_number TEXT,
  p_participant_name TEXT,p_institution TEXT,p_contact_email TEXT,p_contact_phone TEXT,p_team_data JSONB,p_form_data JSONB,
  p_documents JSONB,p_token_hash TEXT,p_idempotency_key TEXT,p_dedupe_key TEXT,p_privacy_version TEXT,p_processing_context JSONB,
  p_is_minor BOOLEAN,p_guardian_name TEXT,p_guardian_contact TEXT
) RETURNS TABLE(id TEXT,"organizationId" TEXT,"competitionId" TEXT,"registrationNumber" TEXT,status "PublicRegistrationStatus")
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE selected_org TEXT; selected_competition TEXT; selected_mode "ParticipantMode"; selected_quota INTEGER; current_count BIGINT;
BEGIN
  IF length(trim(p_privacy_version))<3 THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PRIVACY_CONSENT_REQUIRED'; END IF;
  IF p_is_minor AND (NULLIF(trim(p_guardian_name),'') IS NULL OR NULLIF(trim(p_guardian_contact),'') IS NULL) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='GUARDIAN_CONSENT_REQUIRED'; END IF;
  SELECT competition."organizationId",competition.id,profile."participantMode",profile."registrationQuota" INTO selected_org,selected_competition,selected_mode,selected_quota
  FROM public."CompetitionPublication" publication JOIN public."Competition" competition ON competition.id=publication."competitionId" JOIN public."CompetitionProfile" profile ON profile."competitionId"=competition.id
  WHERE publication."publicSlug"=p_public_slug AND publication.status='PUBLISHED' AND competition.status='REGISTRATION' AND profile."publicRegistrationEnabled"=true
    AND (profile."registrationOpensAt" IS NULL OR profile."registrationOpensAt"<=CURRENT_TIMESTAMP) AND (profile."registrationClosesAt" IS NULL OR profile."registrationClosesAt">=CURRENT_TIMESTAMP)
  FOR UPDATE OF profile;
  IF selected_competition IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REGISTRATION_CLOSED'; END IF;
  IF selected_mode='INDIVIDUAL' AND p_participant_type<>'INDIVIDUAL' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PARTICIPANT_MODE_MISMATCH'; END IF;
  IF selected_mode='TEAM' AND p_participant_type='INDIVIDUAL' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PARTICIPANT_MODE_MISMATCH'; END IF;
  RETURN QUERY SELECT r.id,r."organizationId",r."competitionId",r."registrationNumber",r.status FROM public."PublicRegistration" r WHERE r."organizationId"=selected_org AND r."idempotencyKey"=p_idempotency_key;
  IF FOUND THEN RETURN; END IF;
  SELECT count(*) INTO current_count FROM public."PublicRegistration" r WHERE r."competitionId"=selected_competition AND r.status IN ('SUBMITTED','UNDER_REVIEW','REVISION_REQUESTED','APPROVED');
  IF selected_quota IS NOT NULL AND current_count>=selected_quota THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REGISTRATION_QUOTA_FULL'; END IF;
  INSERT INTO public."PublicRegistration" (id,"organizationId","competitionId","participantType","registrationNumber",status,"participantName",institution,"contactEmail","contactPhone","teamData","formData",documents,"tokenHash","idempotencyKey","dedupeKey","privacyVersion","processingConsentAt","processingContext","isMinor","guardianName","guardianContact","guardianConsentAt","submittedAt","createdAt","updatedAt")
  VALUES (p_id,selected_org,selected_competition,p_participant_type,p_registration_number,'SUBMITTED',p_participant_name,p_institution,p_contact_email,p_contact_phone,p_team_data,p_form_data,p_documents,p_token_hash,p_idempotency_key,p_dedupe_key,p_privacy_version,CURRENT_TIMESTAMP,p_processing_context,p_is_minor,p_guardian_name,p_guardian_contact,CASE WHEN p_is_minor THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO public."PublicRegistrationHistory" (id,"organizationId","registrationId",action,"toStatus",metadata,"createdAt") VALUES (p_history_id,selected_org,p_id,'SUBMIT','SUBMITTED',jsonb_build_object('privacyVersion',p_privacy_version,'isMinor',p_is_minor),CURRENT_TIMESTAMP);
  RETURN QUERY SELECT r.id,r."organizationId",r."competitionId",r."registrationNumber",r.status FROM public."PublicRegistration" r WHERE r.id=p_id;
END $$;

CREATE OR REPLACE FUNCTION public.phase22_submit_privacy_request(p_id TEXT,p_registration_number TEXT,p_registration_token_hash TEXT,p_type "PrivacyRequestType",p_requester_email TEXT,p_requester_email_hash TEXT,p_token_hash TEXT,p_idempotency_key TEXT,p_description TEXT)
RETURNS TABLE(id TEXT,status "PrivacyRequestStatus") LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE selected_registration TEXT; selected_org TEXT;
BEGIN
  SELECT r.id,r."organizationId" INTO selected_registration,selected_org FROM public."PublicRegistration" r WHERE r."registrationNumber"=p_registration_number AND r."tokenHash"=p_registration_token_hash AND lower(r."contactEmail")=lower(p_requester_email);
  IF selected_registration IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REGISTRATION_NOT_FOUND'; END IF;
  RETURN QUERY SELECT q.id,q.status FROM public."PrivacyDataRequest" q WHERE q."organizationId"=selected_org AND q."idempotencyKey"=p_idempotency_key;
  IF FOUND THEN RETURN; END IF;
  INSERT INTO public."PrivacyDataRequest" (id,"organizationId","registrationId",type,status,"requesterEmailHash","tokenHash","idempotencyKey",description,"verifiedAt","createdAt","updatedAt") VALUES (p_id,selected_org,selected_registration,p_type,'VERIFIED',p_requester_email_hash,p_token_hash,p_idempotency_key,p_description,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  IF p_type='ERASURE' THEN UPDATE public."PublicRegistration" AS registration SET "deletionRequestedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE registration.id=selected_registration; END IF;
  RETURN QUERY SELECT q.id,q.status FROM public."PrivacyDataRequest" q WHERE q.id=p_id;
END $$;

INSERT INTO "Permission" (id,key,description) VALUES
 ('phase22_privacy_request_view','privacy.request.view','Melihat permintaan privasi peserta'),
 ('phase22_privacy_request_manage','privacy.request.manage','Memproses permintaan privasi peserta')
ON CONFLICT (key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key IN ('organization-owner','organizer-manager') AND permission.key LIKE 'privacy.request.%' ON CONFLICT DO NOTHING;
