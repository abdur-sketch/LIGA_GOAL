CREATE TYPE "JudgeAssignmentStatus" AS ENUM ('ACTIVE','INACTIVE','REVOKED','EXPIRED');
CREATE TYPE "ResultWorkflowStatus" AS ENUM ('DRAFT','SUBMITTED','REVIEWED','APPROVED','PUBLISHED','REOPENED');
CREATE TYPE "PublicRegistrationStatus" AS ENUM ('SUBMITTED','UNDER_REVIEW','REVISION_REQUESTED','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE "RegistrationReviewAction" AS ENUM ('SUBMIT','START_REVIEW','REQUEST_REVISION','APPROVE','REJECT','WITHDRAW');

ALTER TABLE "CompetitionProfile"
  ADD COLUMN "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "registrationOpensAt" TIMESTAMP(3),
  ADD COLUMN "registrationClosesAt" TIMESTAMP(3),
  ADD COLUMN "registrationQuota" INTEGER,
  ADD COLUMN "registrationRequirements" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CompetitionProfile" ADD CONSTRAINT "CompetitionProfile_registrationQuota_check" CHECK ("registrationQuota" IS NULL OR "registrationQuota" > 0);
ALTER TABLE "CompetitionProfile" ADD CONSTRAINT "CompetitionProfile_registrationWindow_check" CHECK ("registrationOpensAt" IS NULL OR "registrationClosesAt" IS NULL OR "registrationClosesAt" >= "registrationOpensAt");

CREATE TABLE "JudgeAssignment" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "sessionId" TEXT,
  "stageId" TEXT,
  "judgeId" TEXT NOT NULL,
  "assignedById" TEXT NOT NULL,
  "revokedById" TEXT,
  status "JudgeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "conflictDeclared" BOOLEAN NOT NULL DEFAULT false,
  "conflictNotes" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY (id),
  CONSTRAINT "JudgeAssignment_validity_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "JudgeAssignment_conflict_check" CHECK ("conflictDeclared" = false OR length(trim(COALESCE("conflictNotes",''))) >= 3)
);

CREATE TABLE "ResultApprovalWorkflow" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "sessionId" TEXT,
  "scopeKey" TEXT NOT NULL DEFAULT 'competition',
  status "ResultWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
  version INTEGER NOT NULL DEFAULT 1,
  "submittedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "reopenedById" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResultApprovalWorkflow_pkey" PRIMARY KEY (id),
  CONSTRAINT "ResultApprovalWorkflow_distinct_review_check" CHECK ("reviewedById" IS NULL OR "submittedById" IS NULL OR "reviewedById" <> "submittedById"),
  CONSTRAINT "ResultApprovalWorkflow_distinct_approval_check" CHECK ("approvedById" IS NULL OR "submittedById" IS NULL OR "approvedById" <> "submittedById")
);

CREATE TABLE "ResultApprovalHistory" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "ResultWorkflowStatus",
  "toStatus" "ResultWorkflowStatus" NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResultApprovalHistory_pkey" PRIMARY KEY (id)
);

CREATE TABLE "PublicRegistration" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "participantType" "ParticipantType" NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  status "PublicRegistrationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "participantName" TEXT NOT NULL,
  institution TEXT,
  "contactEmail" TEXT NOT NULL,
  "contactPhone" TEXT,
  "teamData" JSONB NOT NULL DEFAULT '{}',
  "formData" JSONB NOT NULL DEFAULT '{}',
  documents JSONB NOT NULL DEFAULT '[]',
  "tokenHash" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "revisionReason" TEXT,
  "rejectionReason" TEXT,
  "approvedParticipantId" TEXT,
  "approvedEntryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicRegistration_pkey" PRIMARY KEY (id)
);

CREATE TABLE "PublicRegistrationHistory" (
  id TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "actorId" TEXT,
  action "RegistrationReviewAction" NOT NULL,
  "fromStatus" "PublicRegistrationStatus",
  "toStatus" "PublicRegistrationStatus" NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicRegistrationHistory_pkey" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "JudgeAssignment_organizationId_idempotencyKey_key" ON "JudgeAssignment"("organizationId","idempotencyKey");
CREATE INDEX "JudgeAssignment_organizationId_competitionId_status_validUn_idx" ON "JudgeAssignment"("organizationId","competitionId",status,"validUntil");
CREATE INDEX "JudgeAssignment_judgeId_status_validFrom_validUntil_idx" ON "JudgeAssignment"("judgeId",status,"validFrom","validUntil");
CREATE INDEX "JudgeAssignment_sessionId_judgeId_status_idx" ON "JudgeAssignment"("sessionId","judgeId",status);
CREATE UNIQUE INDEX "ResultApprovalWorkflow_competitionId_scopeKey_key" ON "ResultApprovalWorkflow"("competitionId","scopeKey");
CREATE INDEX "ResultApprovalWorkflow_organizationId_status_updatedAt_idx" ON "ResultApprovalWorkflow"("organizationId",status,"updatedAt");
CREATE INDEX "ResultApprovalWorkflow_sessionId_status_idx" ON "ResultApprovalWorkflow"("sessionId",status);
CREATE INDEX "ResultApprovalHistory_organizationId_workflowId_createdAt_idx" ON "ResultApprovalHistory"("organizationId","workflowId","createdAt");
CREATE INDEX "ResultApprovalHistory_actorId_createdAt_idx" ON "ResultApprovalHistory"("actorId","createdAt");
CREATE UNIQUE INDEX "PublicRegistration_registrationNumber_key" ON "PublicRegistration"("registrationNumber");
CREATE UNIQUE INDEX "PublicRegistration_tokenHash_key" ON "PublicRegistration"("tokenHash");
CREATE UNIQUE INDEX "PublicRegistration_approvedEntryId_key" ON "PublicRegistration"("approvedEntryId");
CREATE UNIQUE INDEX "PublicRegistration_organizationId_competitionId_idempotency_key" ON "PublicRegistration"("organizationId","competitionId","idempotencyKey");
CREATE UNIQUE INDEX "PublicRegistration_competitionId_dedupeKey_key" ON "PublicRegistration"("competitionId","dedupeKey");
CREATE INDEX "PublicRegistration_organizationId_competitionId_status_subm_idx" ON "PublicRegistration"("organizationId","competitionId",status,"submittedAt");
CREATE INDEX "PublicRegistration_contactEmail_competitionId_status_idx" ON "PublicRegistration"("contactEmail","competitionId",status);
CREATE INDEX "PublicRegistrationHistory_organizationId_registrationId_cre_idx" ON "PublicRegistrationHistory"("organizationId","registrationId","createdAt");
CREATE INDEX "PublicRegistrationHistory_actorId_createdAt_idx" ON "PublicRegistrationHistory"("actorId","createdAt");

ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CompetitionSession"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CompetitionSession"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalWorkflow" ADD CONSTRAINT "ResultApprovalWorkflow_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalHistory" ADD CONSTRAINT "ResultApprovalHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalHistory" ADD CONSTRAINT "ResultApprovalHistory_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ResultApprovalWorkflow"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultApprovalHistory" ADD CONSTRAINT "ResultApprovalHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_approvedParticipantId_fkey" FOREIGN KEY ("approvedParticipantId") REFERENCES "CompetitionParticipant"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_approvedEntryId_fkey" FOREIGN KEY ("approvedEntryId") REFERENCES "GenericCompetitionEntry"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PublicRegistrationHistory" ADD CONSTRAINT "PublicRegistrationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicRegistrationHistory" ADD CONSTRAINT "PublicRegistrationHistory_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PublicRegistration"(id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicRegistrationHistory" ADD CONSTRAINT "PublicRegistrationHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.phase21_validate_operations_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='JudgeAssignment' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" c WHERE c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId")
      OR (NEW."sessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id=NEW."sessionId" AND s."competitionId"=NEW."competitionId" AND s."organizationId"=NEW."organizationId"))
      OR (NEW."stageId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Stage" stage JOIN "Season" season ON season.id=stage."seasonId" WHERE stage.id=NEW."stageId" AND stage."organizationId"=NEW."organizationId" AND season."competitionId"=NEW."competitionId"))
      OR NOT EXISTS (SELECT 1 FROM "OrganizationMember" member JOIN "User" actor ON actor.id=member."userId" WHERE member."organizationId"=NEW."organizationId" AND member."userId"=NEW."judgeId" AND member."isActive"=true AND actor."isActive"=true AND actor."deletedAt" IS NULL)
    THEN RAISE EXCEPTION 'judge assignment tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME='ResultApprovalWorkflow' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" c WHERE c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId")
      OR (NEW."sessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id=NEW."sessionId" AND s."competitionId"=NEW."competitionId" AND s."organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'result workflow tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME='ResultApprovalHistory' THEN
    IF NOT EXISTS (SELECT 1 FROM "ResultApprovalWorkflow" workflow WHERE workflow.id=NEW."workflowId" AND workflow."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'result history tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME='PublicRegistration' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" c WHERE c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId")
      OR (NEW."approvedParticipantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" participant WHERE participant.id=NEW."approvedParticipantId" AND participant."organizationId"=NEW."organizationId"))
      OR (NEW."approvedEntryId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "GenericCompetitionEntry" entry WHERE entry.id=NEW."approvedEntryId" AND entry."organizationId"=NEW."organizationId" AND entry."competitionId"=NEW."competitionId"))
    THEN RAISE EXCEPTION 'public registration tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME='PublicRegistrationHistory' THEN
    IF NOT EXISTS (SELECT 1 FROM "PublicRegistration" registration WHERE registration.id=NEW."registrationId" AND registration."organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'registration history tenant boundary violation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase21_judge_assignment_guard BEFORE INSERT OR UPDATE ON "JudgeAssignment" FOR EACH ROW EXECUTE FUNCTION public.phase21_validate_operations_tenant();
CREATE TRIGGER phase21_result_workflow_guard BEFORE INSERT OR UPDATE ON "ResultApprovalWorkflow" FOR EACH ROW EXECUTE FUNCTION public.phase21_validate_operations_tenant();
CREATE TRIGGER phase21_result_history_guard BEFORE INSERT OR UPDATE ON "ResultApprovalHistory" FOR EACH ROW EXECUTE FUNCTION public.phase21_validate_operations_tenant();
CREATE TRIGGER phase21_public_registration_guard BEFORE INSERT OR UPDATE ON "PublicRegistration" FOR EACH ROW EXECUTE FUNCTION public.phase21_validate_operations_tenant();
CREATE TRIGGER phase21_registration_history_guard BEFORE INSERT OR UPDATE ON "PublicRegistrationHistory" FOR EACH ROW EXECUTE FUNCTION public.phase21_validate_operations_tenant();

CREATE OR REPLACE FUNCTION public.phase21_guard_approved_results() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE competition_id TEXT; scope_key TEXT; locked BOOLEAN;
BEGIN
  IF current_setting('app.allow_result_workflow_write',true)='true' THEN RETURN COALESCE(NEW,OLD); END IF;
  IF TG_TABLE_NAME='GenericScoreEntry' THEN
    SELECT s."competitionId",s.id INTO competition_id,scope_key FROM "CompetitionSession" s WHERE s.id=COALESCE(NEW."sessionId",OLD."sessionId");
  ELSE
    competition_id=COALESCE(NEW."competitionId",OLD."competitionId"); scope_key=COALESCE(NEW."scopeKey",OLD."scopeKey");
  END IF;
  SELECT EXISTS (SELECT 1 FROM "ResultApprovalWorkflow" workflow WHERE workflow."competitionId"=competition_id AND workflow."scopeKey"=scope_key AND workflow.status IN ('APPROVED','PUBLISHED')) INTO locked;
  IF locked THEN RAISE EXCEPTION 'approved result is locked; reopen workflow first'; END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER phase21_score_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON "GenericScoreEntry" FOR EACH ROW EXECUTE FUNCTION public.phase21_guard_approved_results();
CREATE TRIGGER phase21_result_lock_guard BEFORE INSERT OR UPDATE OR DELETE ON "GenericResult" FOR EACH ROW EXECUTE FUNCTION public.phase21_guard_approved_results();

ALTER TABLE "JudgeAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase21_judge_tenant ON "JudgeAssignment" FOR ALL USING (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId"));
ALTER TABLE "ResultApprovalWorkflow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase21_result_workflow_tenant ON "ResultApprovalWorkflow" FOR ALL USING (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId"));
ALTER TABLE "ResultApprovalHistory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase21_result_history_tenant ON "ResultApprovalHistory" FOR ALL USING (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true)<>'public' AND public.app_tenant_allowed("organizationId"));
ALTER TABLE "PublicRegistration" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase21_registration_tenant ON "PublicRegistration" FOR ALL USING (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId"));
CREATE POLICY phase21_registration_token_read ON "PublicRegistration" FOR SELECT USING (current_setting('app.access_mode',true)='registration' AND "tokenHash"=NULLIF(current_setting('app.current_registration_token_hash',true),''));
ALTER TABLE "PublicRegistrationHistory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase21_registration_history_tenant ON "PublicRegistrationHistory" FOR ALL USING (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId")) WITH CHECK (current_setting('app.access_mode',true) NOT IN ('public','registration') AND public.app_tenant_allowed("organizationId"));
CREATE POLICY phase21_registration_history_token_read ON "PublicRegistrationHistory" FOR SELECT USING (current_setting('app.access_mode',true)='registration' AND EXISTS (SELECT 1 FROM "PublicRegistration" registration WHERE registration.id="PublicRegistrationHistory"."registrationId" AND registration."tokenHash"=NULLIF(current_setting('app.current_registration_token_hash',true),'')));

CREATE OR REPLACE FUNCTION public.phase21_submit_public_registration(
  p_id TEXT,
  p_history_id TEXT,
  p_public_slug TEXT,
  p_participant_type "ParticipantType",
  p_registration_number TEXT,
  p_participant_name TEXT,
  p_institution TEXT,
  p_contact_email TEXT,
  p_contact_phone TEXT,
  p_team_data JSONB,
  p_form_data JSONB,
  p_documents JSONB,
  p_token_hash TEXT,
  p_idempotency_key TEXT,
  p_dedupe_key TEXT
) RETURNS TABLE(id TEXT,"organizationId" TEXT,"competitionId" TEXT,"registrationNumber" TEXT,status "PublicRegistrationStatus")
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE selected_org TEXT; selected_competition TEXT; selected_mode "ParticipantMode"; selected_quota INTEGER; current_count BIGINT;
BEGIN
  SELECT competition."organizationId",competition.id,profile."participantMode",profile."registrationQuota"
  INTO selected_org,selected_competition,selected_mode,selected_quota
  FROM public."CompetitionPublication" publication
  JOIN public."Competition" competition ON competition.id=publication."competitionId"
  JOIN public."CompetitionProfile" profile ON profile."competitionId"=competition.id
  WHERE publication."publicSlug"=p_public_slug AND publication.status='PUBLISHED' AND competition.status='REGISTRATION'
    AND profile."publicRegistrationEnabled"=true
    AND (profile."registrationOpensAt" IS NULL OR profile."registrationOpensAt"<=CURRENT_TIMESTAMP)
    AND (profile."registrationClosesAt" IS NULL OR profile."registrationClosesAt">=CURRENT_TIMESTAMP)
  FOR UPDATE OF profile;
  IF selected_competition IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REGISTRATION_CLOSED'; END IF;
  IF selected_mode='INDIVIDUAL' AND p_participant_type<>'INDIVIDUAL' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PARTICIPANT_MODE_MISMATCH'; END IF;
  IF selected_mode='TEAM' AND p_participant_type='INDIVIDUAL' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='PARTICIPANT_MODE_MISMATCH'; END IF;
  RETURN QUERY SELECT registration.id,registration."organizationId",registration."competitionId",registration."registrationNumber",registration.status
    FROM public."PublicRegistration" registration
    WHERE registration."organizationId"=selected_org AND registration."idempotencyKey"=p_idempotency_key;
  IF FOUND THEN RETURN; END IF;
  SELECT count(*) INTO current_count FROM public."PublicRegistration" registration WHERE registration."competitionId"=selected_competition AND registration.status IN ('SUBMITTED','UNDER_REVIEW','REVISION_REQUESTED','APPROVED');
  IF selected_quota IS NOT NULL AND current_count>=selected_quota THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='REGISTRATION_QUOTA_FULL'; END IF;
  INSERT INTO public."PublicRegistration" (id,"organizationId","competitionId","participantType","registrationNumber",status,"participantName",institution,"contactEmail","contactPhone","teamData","formData",documents,"tokenHash","idempotencyKey","dedupeKey","submittedAt","createdAt","updatedAt")
  VALUES (p_id,selected_org,selected_competition,p_participant_type,p_registration_number,'SUBMITTED',p_participant_name,p_institution,p_contact_email,p_contact_phone,p_team_data,p_form_data,p_documents,p_token_hash,p_idempotency_key,p_dedupe_key,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
  INSERT INTO public."PublicRegistrationHistory" (id,"organizationId","registrationId",action,"toStatus",metadata,"createdAt") VALUES (p_history_id,selected_org,p_id,'SUBMIT','SUBMITTED','{}',CURRENT_TIMESTAMP);
  RETURN QUERY SELECT registration.id,registration."organizationId",registration."competitionId",registration."registrationNumber",registration.status FROM public."PublicRegistration" registration WHERE registration.id=p_id;
END $$;

INSERT INTO "Permission" (id,key,description) VALUES
 ('phase21_judge_assignment_view','judge.assignment.view','Melihat penugasan juri'),
 ('phase21_judge_assignment_manage','judge.assignment.manage','Mengelola penugasan juri'),
 ('phase21_registration_view','registration.public.view','Melihat pendaftaran peserta publik'),
 ('phase21_registration_review','registration.public.review','Memverifikasi pendaftaran peserta publik'),
 ('phase21_result_workflow_view','result.workflow.view','Melihat workflow persetujuan hasil'),
 ('phase21_result_workflow_submit','result.workflow.submit','Mengajukan hasil untuk review'),
 ('phase21_result_workflow_review','result.workflow.review','Mereview hasil'),
 ('phase21_result_workflow_approve','result.workflow.approve','Menyetujui hasil'),
 ('phase21_result_workflow_publish','result.workflow.publish','Mempublikasikan hasil'),
 ('phase21_result_workflow_reopen','result.workflow.reopen','Membuka kembali hasil terkunci')
ON CONFLICT (key) DO NOTHING;

INSERT INTO "Role" (id,"organizationId",name,key,"isSystem") SELECT 'phase21-judge-'||id,id,'Juri','judge',true FROM "Organization" ON CONFLICT ("organizationId",key) DO NOTHING;
INSERT INTO "Role" (id,"organizationId",name,key,"isSystem") SELECT 'phase21-verifier-'||id,id,'Verifikator','registration-verifier',true FROM "Organization" ON CONFLICT ("organizationId",key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key IN ('organization-owner','organizer-manager') AND permission.key LIKE ANY (ARRAY['judge.assignment.%','registration.public.%','result.workflow.%']) ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key='competition-editor' AND permission.key IN ('judge.assignment.view','judge.assignment.manage','registration.public.view','registration.public.review','result.workflow.view','result.workflow.submit','result.workflow.review','result.workflow.approve','result.workflow.publish') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key='judge' AND permission.key IN ('competition.view','competition_session.view','generic_scoring.view','generic_scoring.manage','judge.assignment.view','result.workflow.view','result.workflow.submit') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key='registration-verifier' AND permission.key IN ('competition.view','participant.view','participant.manage','registration.public.view','registration.public.review') ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT role.id,permission.id FROM "Role" role CROSS JOIN "Permission" permission WHERE role.key='viewer' AND permission.key IN ('judge.assignment.view','registration.public.view','result.workflow.view') ON CONFLICT DO NOTHING;

INSERT INTO "ResultApprovalWorkflow" (id,"organizationId","competitionId","sessionId","scopeKey",status,"publishedAt","lockedAt","createdAt","updatedAt")
SELECT 'phase21-wf-'||substr(md5(result."competitionId"||result."scopeKey"),1,24),min(result."organizationId"),result."competitionId",min(result."sessionId"),result."scopeKey",'PUBLISHED',max(result."publishedAt"),max(result."publishedAt"),CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM "GenericResult" result WHERE result.status='PUBLISHED' GROUP BY result."competitionId",result."scopeKey" ON CONFLICT ("competitionId","scopeKey") DO NOTHING;
