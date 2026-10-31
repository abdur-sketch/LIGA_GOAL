-- Phase 19: additive multi-competition foundation.
-- Existing football tables and identifiers remain unchanged.

CREATE TYPE "CompetitionKind" AS ENUM ('FOOTBALL','QUIZ','ACADEMIC','ARTS','RELIGIOUS','FESTIVAL','ESPORTS','OTHER');
CREATE TYPE "ParticipantMode" AS ENUM ('INDIVIDUAL','TEAM','BOTH');
CREATE TYPE "ParticipantType" AS ENUM ('INDIVIDUAL','TEAM','INSTITUTION');
CREATE TYPE "GenericEntryStatus" AS ENUM ('DRAFT','SUBMITTED','VERIFIED','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE "ScoringMethod" AS ENUM ('POINTS','JUDGES','TIME','KNOCKOUT','CUSTOM');
CREATE TYPE "CompetitionSessionStatus" AS ENUM ('DRAFT','SCHEDULED','LIVE','COMPLETED','POSTPONED','CANCELLED');
CREATE TYPE "GenericScoreStatus" AS ENUM ('DRAFT','SUBMITTED','VERIFIED','PUBLISHED','VOID');

ALTER TABLE "Competition" ADD COLUMN "parentCompetitionId" TEXT;
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_parentCompetitionId_fkey"
  FOREIGN KEY ("parentCompetitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Competition_organizationId_parentCompetitionId_deletedAt_idx"
  ON "Competition"("organizationId","parentCompetitionId","deletedAt");

CREATE TABLE "CompetitionTemplate" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL, "description" TEXT NOT NULL, "kind" "CompetitionKind" NOT NULL,
  "participantMode" "ParticipantMode" NOT NULL, "scoringMethod" "ScoringMethod" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompetitionTemplate_code_version_key" ON "CompetitionTemplate"("code","version");
CREATE INDEX "CompetitionTemplate_kind_isActive_idx" ON "CompetitionTemplate"("kind","isActive");

CREATE TABLE "CompetitionProfile" (
  "id" TEXT NOT NULL, "competitionId" TEXT NOT NULL, "templateId" TEXT,
  "kind" "CompetitionKind" NOT NULL, "participantMode" "ParticipantMode" NOT NULL,
  "scoringMethod" "ScoringMethod" NOT NULL, "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitionProfile_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitionProfile_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompetitionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompetitionProfile_competitionId_key" ON "CompetitionProfile"("competitionId");
CREATE INDEX "CompetitionProfile_kind_scoringMethod_idx" ON "CompetitionProfile"("kind","scoringMethod");

CREATE TABLE "CompetitionParticipant" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "type" "ParticipantType" NOT NULL,
  "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "displayName" TEXT, "logoUrl" TEXT,
  "institution" TEXT, "contactEmail" TEXT, "contactPhone" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3), CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitionParticipant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompetitionParticipant_organizationId_slug_key" ON "CompetitionParticipant"("organizationId","slug");
CREATE INDEX "CompetitionParticipant_organizationId_type_isActive_deletedAt_idx" ON "CompetitionParticipant"("organizationId","type","isActive","deletedAt");

CREATE TABLE "GenericCompetitionEntry" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT NOT NULL,
  "seasonId" TEXT, "participantId" TEXT NOT NULL, "entryName" TEXT,
  "status" "GenericEntryStatus" NOT NULL DEFAULT 'DRAFT', "seed" INTEGER,
  "registrationData" JSONB NOT NULL DEFAULT '{}', "idempotencyKey" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenericCompetitionEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GenericCompetitionEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericCompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericCompetitionEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericCompetitionEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CompetitionParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GenericCompetitionEntry_organizationId_idempotencyKey_key" ON "GenericCompetitionEntry"("organizationId","idempotencyKey");
CREATE UNIQUE INDEX "GenericCompetitionEntry_competitionId_seasonId_participantId_key" ON "GenericCompetitionEntry"("competitionId","seasonId","participantId");
CREATE INDEX "GenericCompetitionEntry_organizationId_competitionId_status_idx" ON "GenericCompetitionEntry"("organizationId","competitionId","status");

CREATE TABLE "CompetitionSession" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT NOT NULL,
  "seasonId" TEXT, "stageId" TEXT, "venueId" TEXT, "name" TEXT NOT NULL, "sequence" INTEGER NOT NULL,
  "status" "CompetitionSessionStatus" NOT NULL DEFAULT 'DRAFT', "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3),
  "config" JSONB NOT NULL DEFAULT '{}', "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompetitionSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetitionSession_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetitionSession_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetitionSession_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompetitionSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompetitionSession_competitionId_sequence_key" ON "CompetitionSession"("competitionId","sequence");
CREATE INDEX "CompetitionSession_organizationId_competitionId_status_startsAt_idx" ON "CompetitionSession"("organizationId","competitionId","status","startsAt");

CREATE TABLE "CompetitionSessionEntry" (
  "sessionId" TEXT NOT NULL, "entryId" TEXT NOT NULL, "lane" TEXT, "order" INTEGER,
  CONSTRAINT "CompetitionSessionEntry_pkey" PRIMARY KEY ("sessionId","entryId"),
  CONSTRAINT "CompetitionSessionEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CompetitionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompetitionSessionEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GenericCompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CompetitionSessionEntry_entryId_idx" ON "CompetitionSessionEntry"("entryId");

CREATE TABLE "ScoringCriterion" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "code" TEXT NOT NULL, "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "maxScore" DOUBLE PRECISION, "sortOrder" INTEGER NOT NULL DEFAULT 0, "config" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScoringCriterion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ScoringCriterion_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ScoringCriterion_competitionId_code_key" ON "ScoringCriterion"("competitionId","code");
CREATE INDEX "ScoringCriterion_organizationId_competitionId_sortOrder_idx" ON "ScoringCriterion"("organizationId","competitionId","sortOrder");

CREATE TABLE "GenericScoreEntry" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "entryId" TEXT NOT NULL,
  "criterionId" TEXT, "judgeId" TEXT, "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "penalty" DOUBLE PRECISION NOT NULL DEFAULT 0, "status" "GenericScoreStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT, "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenericScoreEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GenericScoreEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericScoreEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CompetitionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericScoreEntry_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GenericCompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericScoreEntry_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScoringCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericScoreEntry_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GenericScoreEntry_organizationId_idempotencyKey_key" ON "GenericScoreEntry"("organizationId","idempotencyKey");
CREATE INDEX "GenericScoreEntry_organizationId_sessionId_entryId_status_idx" ON "GenericScoreEntry"("organizationId","sessionId","entryId","status");
CREATE INDEX "GenericScoreEntry_judgeId_createdAt_idx" ON "GenericScoreEntry"("judgeId","createdAt");

CREATE TABLE "GenericResult" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT NOT NULL,
  "sessionId" TEXT, "scopeKey" TEXT NOT NULL DEFAULT 'competition', "entryId" TEXT NOT NULL, "rank" INTEGER, "totalScore" DOUBLE PRECISION NOT NULL,
  "tieBreakData" JSONB NOT NULL DEFAULT '{}', "status" "GenericScoreStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GenericResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GenericResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericResult_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CompetitionSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GenericResult_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GenericCompetitionEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "GenericResult_competitionId_scopeKey_entryId_key" ON "GenericResult"("competitionId","scopeKey","entryId");
CREATE INDEX "GenericResult_organizationId_competitionId_status_rank_idx" ON "GenericResult"("organizationId","competitionId","status","rank");

-- Guard every generic relation against cross-tenant IDs, including nullable season/stage/venue links.
CREATE FUNCTION public.phase19_validate_generic_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Competition' AND NEW."parentCompetitionId" IS NOT NULL THEN
    SELECT "organizationId" INTO expected_org FROM "Competition" WHERE id=NEW."parentCompetitionId";
    IF expected_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'parent competition belongs to another tenant'; END IF;
  ELSIF TG_TABLE_NAME = 'GenericCompetitionEntry' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId")
      OR NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" WHERE id=NEW."participantId" AND "organizationId"=NEW."organizationId")
      OR (NEW."seasonId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Season" s JOIN "Competition" c ON c.id=s."competitionId" WHERE s.id=NEW."seasonId" AND c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'generic entry tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'CompetitionSession' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId")
      OR (NEW."seasonId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Season" s WHERE s.id=NEW."seasonId" AND s."competitionId"=NEW."competitionId"))
      OR (NEW."stageId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Stage" WHERE id=NEW."stageId" AND "organizationId"=NEW."organizationId"))
      OR (NEW."venueId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Venue" WHERE id=NEW."venueId" AND "organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'competition session tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'ScoringCriterion' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'criterion tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'GenericScoreEntry' THEN
    IF NOT EXISTS (SELECT 1 FROM "CompetitionSession" s JOIN "GenericCompetitionEntry" e ON e.id=NEW."entryId" WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND e."organizationId"=NEW."organizationId" AND e."competitionId"=s."competitionId")
      OR (NEW."criterionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ScoringCriterion" c JOIN "CompetitionSession" s ON s."competitionId"=c."competitionId" WHERE c.id=NEW."criterionId" AND s.id=NEW."sessionId" AND c."organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'generic score tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'GenericResult' THEN
    IF NOT EXISTS (SELECT 1 FROM "GenericCompetitionEntry" e WHERE e.id=NEW."entryId" AND e."organizationId"=NEW."organizationId" AND e."competitionId"=NEW."competitionId")
      OR (NEW."sessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND s."competitionId"=NEW."competitionId"))
    THEN RAISE EXCEPTION 'generic result tenant boundary violation'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER phase19_competition_parent_guard BEFORE INSERT OR UPDATE OF "organizationId","parentCompetitionId" ON "Competition" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();
CREATE TRIGGER phase19_entry_guard BEFORE INSERT OR UPDATE ON "GenericCompetitionEntry" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();
CREATE TRIGGER phase19_session_guard BEFORE INSERT OR UPDATE ON "CompetitionSession" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();
CREATE TRIGGER phase19_criterion_guard BEFORE INSERT OR UPDATE ON "ScoringCriterion" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();
CREATE TRIGGER phase19_score_guard BEFORE INSERT OR UPDATE ON "GenericScoreEntry" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();
CREATE TRIGGER phase19_result_guard BEFORE INSERT OR UPDATE ON "GenericResult" FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();

-- Default-deny tenant tables. Public policies expose only published schedules/results and approved entries.
ALTER TABLE "CompetitionTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_template_read ON "CompetitionTemplate" FOR SELECT USING ("isActive"=true AND current_setting('app.access_mode',true) IN ('tenant','public','platform'));
CREATE POLICY phase19_template_platform ON "CompetitionTemplate" FOR ALL USING (current_setting('app.access_mode',true)='platform') WITH CHECK (current_setting('app.access_mode',true)='platform');

ALTER TABLE "CompetitionProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_profile_tenant ON "CompetitionProfile" FOR ALL USING (EXISTS (SELECT 1 FROM "Competition" c WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM "Competition" c WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId")));
CREATE POLICY phase19_profile_public ON "CompetitionProfile" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "Competition" c JOIN "CompetitionPublication" p ON p."competitionId"=c.id WHERE c.id="CompetitionProfile"."competitionId" AND p.status='PUBLISHED'));

ALTER TABLE "CompetitionParticipant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_participant_tenant ON "CompetitionParticipant" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY phase19_participant_public ON "CompetitionParticipant" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND "isActive"=true AND "deletedAt" IS NULL AND EXISTS (SELECT 1 FROM "GenericCompetitionEntry" e JOIN "CompetitionPublication" p ON p."competitionId"=e."competitionId" WHERE e."participantId"="CompetitionParticipant".id AND e.status='APPROVED' AND p.status='PUBLISHED'));

ALTER TABLE "GenericCompetitionEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_entry_tenant ON "GenericCompetitionEntry" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY phase19_entry_public ON "GenericCompetitionEntry" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND status='APPROVED' AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="GenericCompetitionEntry"."competitionId" AND p.status='PUBLISHED'));

ALTER TABLE "CompetitionSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_session_tenant ON "CompetitionSession" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY phase19_session_public ON "CompetitionSession" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND "publishedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="CompetitionSession"."competitionId" AND p.status='PUBLISHED'));

ALTER TABLE "CompetitionSessionEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_session_entry_tenant ON "CompetitionSessionEntry" FOR ALL USING (EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId")));
CREATE POLICY phase19_session_entry_public ON "CompetitionSessionEntry" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND s."publishedAt" IS NOT NULL));

ALTER TABLE "ScoringCriterion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_criterion_tenant ON "ScoringCriterion" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY phase19_criterion_public ON "ScoringCriterion" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="ScoringCriterion"."competitionId" AND p.status='PUBLISHED'));

ALTER TABLE "GenericScoreEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_score_tenant ON "GenericScoreEntry" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));

ALTER TABLE "GenericResult" ENABLE ROW LEVEL SECURITY;
CREATE POLICY phase19_result_tenant ON "GenericResult" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY phase19_result_public ON "GenericResult" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND status='PUBLISHED' AND "publishedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="GenericResult"."competitionId" AND p.status='PUBLISHED'));

INSERT INTO "CompetitionTemplate" (id,code,version,name,description,kind,"participantMode","scoringMethod",config,"updatedAt") VALUES
('tpl-football-v1','football',1,'Sepak Bola','Liga dan turnamen sepak bola dengan modul pertandingan existing.','FOOTBALL','TEAM','POINTS','{"features":["fixtures","lineups","goals","cards","standings"]}',CURRENT_TIMESTAMP),
('tpl-lct-v1','lct',1,'Lomba Cerdas Tangkas','Kompetisi regu berbabak dengan skor benar, salah, rebutan, dan penalti.','QUIZ','TEAM','POINTS','{"rounds":["penyisihan","semifinal","final"],"scoreEvents":["correct","wrong","bonus","penalty"]}',CURRENT_TIMESTAMP),
('tpl-school-v1','school',1,'Lomba Sekolah','Template fleksibel untuk lomba akademik individu atau tim antarsekolah.','ACADEMIC','BOTH','JUDGES','{"fields":["school","grade","category"],"criteria":["substance","accuracy","presentation"]}',CURRENT_TIMESTAMP),
('tpl-arts-v1','arts',1,'Lomba Seni','Penilaian berbobot oleh satu atau beberapa juri.','ARTS','BOTH','JUDGES','{"criteria":["technique","creativity","presentation"]}',CURRENT_TIMESTAMP),
('tpl-religious-v1','religious',1,'Lomba Keagamaan','Lomba individu atau beregu dengan rubrik penilaian yang dapat dikonfigurasi.','RELIGIOUS','BOTH','JUDGES','{"criteria":["accuracy","fluency","presentation"]}',CURRENT_TIMESTAMP),
('tpl-festival-v1','festival',1,'Gebyar / Festival','Acara induk dengan banyak cabang lomba, agenda, lokasi, dan hasil.','FESTIVAL','BOTH','CUSTOM','{"supportsBranches":true,"features":["multi_competition","shared_schedule"]}',CURRENT_TIMESTAMP),
('tpl-esports-v1','esports',1,'E-Sports','Turnamen tim atau individu berbasis grup dan bracket.','ESPORTS','BOTH','KNOCKOUT','{"features":["groups","bracket","best_of"]}',CURRENT_TIMESTAMP),
('tpl-custom-v1','custom',1,'Lomba Custom','Konfigurasi peserta, babak, sesi, kriteria, dan hasil sesuai kebutuhan.','OTHER','BOTH','CUSTOM','{"configurable":true}',CURRENT_TIMESTAMP)
ON CONFLICT (code,version) DO NOTHING;

INSERT INTO "Permission" (id,key,description) VALUES
('phase19_participant_view','participant.view','Melihat peserta kompetisi umum'),
('phase19_participant_manage','participant.manage','Mengelola peserta kompetisi umum'),
('phase19_session_view','competition_session.view','Melihat sesi dan babak kompetisi umum'),
('phase19_session_manage','competition_session.manage','Mengelola sesi dan babak kompetisi umum'),
('phase19_scoring_view','generic_scoring.view','Melihat nilai dan hasil kompetisi umum'),
('phase19_scoring_manage','generic_scoring.manage','Mengelola nilai dan hasil kompetisi umum')
ON CONFLICT (key) DO NOTHING;

INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key IN ('organization-owner','organizer-manager') AND p.key IN ('participant.view','participant.manage','competition_session.view','competition_session.manage','generic_scoring.view','generic_scoring.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key='competition-editor' AND p.key IN ('participant.view','participant.manage','competition_session.view','competition_session.manage','generic_scoring.view','generic_scoring.manage')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId")
SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.key='viewer' AND p.key IN ('participant.view','competition_session.view','generic_scoring.view')
ON CONFLICT DO NOTHING;

-- Existing competitions remain behaviorally identical and are explicitly classified as football.
INSERT INTO "CompetitionProfile" (id,"competitionId",kind,"participantMode","scoringMethod",config,"updatedAt")
SELECT 'phase19-profile-'||c.id,c.id,'FOOTBALL','TEAM','POINTS','{"legacyFootball":true}',CURRENT_TIMESTAMP
FROM "Competition" c ON CONFLICT ("competitionId") DO NOTHING;
