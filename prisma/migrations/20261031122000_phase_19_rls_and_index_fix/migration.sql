-- Qualify outer-row references in public RLS policies and align long index
-- names with Prisma's deterministic identifier shortening.
DROP POLICY phase19_profile_tenant ON "CompetitionProfile";
DROP POLICY phase19_profile_public ON "CompetitionProfile";
CREATE POLICY phase19_profile_tenant ON "CompetitionProfile" FOR ALL USING (EXISTS (SELECT 1 FROM "Competition" c WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM "Competition" c WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId")));
CREATE POLICY phase19_profile_public ON "CompetitionProfile" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "Competition" c JOIN "CompetitionPublication" p ON p."competitionId"=c.id WHERE c.id="CompetitionProfile"."competitionId" AND p.status='PUBLISHED'));

DROP POLICY phase19_participant_public ON "CompetitionParticipant";
CREATE POLICY phase19_participant_public ON "CompetitionParticipant" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND "isActive"=true AND "deletedAt" IS NULL AND EXISTS (SELECT 1 FROM "GenericCompetitionEntry" e JOIN "CompetitionPublication" p ON p."competitionId"=e."competitionId" WHERE e."participantId"="CompetitionParticipant".id AND e.status='APPROVED' AND p.status='PUBLISHED'));
DROP POLICY phase19_entry_public ON "GenericCompetitionEntry";
CREATE POLICY phase19_entry_public ON "GenericCompetitionEntry" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND status='APPROVED' AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="GenericCompetitionEntry"."competitionId" AND p.status='PUBLISHED'));
DROP POLICY phase19_session_public ON "CompetitionSession";
CREATE POLICY phase19_session_public ON "CompetitionSession" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND "publishedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="CompetitionSession"."competitionId" AND p.status='PUBLISHED'));
DROP POLICY phase19_session_entry_tenant ON "CompetitionSessionEntry";
DROP POLICY phase19_session_entry_public ON "CompetitionSessionEntry";
CREATE POLICY phase19_session_entry_tenant ON "CompetitionSessionEntry" FOR ALL USING (EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId")));
CREATE POLICY phase19_session_entry_public ON "CompetitionSessionEntry" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "CompetitionSession" s WHERE s.id="CompetitionSessionEntry"."sessionId" AND s."publishedAt" IS NOT NULL));
DROP POLICY phase19_criterion_public ON "ScoringCriterion";
CREATE POLICY phase19_criterion_public ON "ScoringCriterion" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="ScoringCriterion"."competitionId" AND p.status='PUBLISHED'));
DROP POLICY phase19_result_public ON "GenericResult";
CREATE POLICY phase19_result_public ON "GenericResult" FOR SELECT USING (current_setting('app.access_mode',true)='public' AND status='PUBLISHED' AND "publishedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "CompetitionPublication" p WHERE p."competitionId"="GenericResult"."competitionId" AND p.status='PUBLISHED'));

ALTER INDEX IF EXISTS "CompetitionParticipant_organizationId_type_isActive_deletedAt_i" RENAME TO "CompetitionParticipant_organizationId_type_isActive_deleted_idx";
ALTER INDEX IF EXISTS "CompetitionSession_organizationId_competitionId_status_startsAt" RENAME TO "CompetitionSession_organizationId_competitionId_status_star_idx";
ALTER INDEX IF EXISTS "GenericCompetitionEntry_competitionId_seasonId_participantId_ke" RENAME TO "GenericCompetitionEntry_competitionId_seasonId_participantI_key";
