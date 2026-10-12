-- Phase 9: default-deny tenant isolation for runtime roles.
-- Table owners and superusers bypass ordinary RLS; production must use the
-- separately provisioned non-owner/NOBYPASSRLS runtime role.

CREATE OR REPLACE FUNCTION public.app_tenant_allowed(value text)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT current_setting('app.platform_admin', true) = 'true'
    OR value = NULLIF(current_setting('app.current_organization_id', true), '')
$$;

DO $rls$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public' AND c.column_name = 'organizationId' AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_default_deny ON public.%I FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"))', table_name);
  END LOOP;
END $rls$;

ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."Organization" FOR ALL
  USING (public.app_tenant_allowed(id)) WITH CHECK (public.app_tenant_allowed(id));

ALTER TABLE public."Season" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."Season" FOR ALL USING (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "Season"."competitionId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "Season"."competitionId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."CompetitionRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."CompetitionRule" FOR ALL USING (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "CompetitionRule"."competitionId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "CompetitionRule"."competitionId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."Team" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."Team" FOR ALL USING (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "Team"."competitionId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Competition" p WHERE p.id = "Team"."competitionId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."PlayerPrivateProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."PlayerPrivateProfile" FOR ALL USING (EXISTS (SELECT 1 FROM public."Player" p WHERE p.id = "PlayerPrivateProfile"."playerId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Player" p WHERE p.id = "PlayerPrivateProfile"."playerId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."PlayerDocumentVerification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."PlayerDocumentVerification" FOR ALL USING (EXISTS (SELECT 1 FROM public."PlayerDocument" p WHERE p.id = "PlayerDocumentVerification"."documentId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."PlayerDocument" p WHERE p.id = "PlayerDocumentVerification"."documentId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."OfficialAssignment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."OfficialAssignment" FOR ALL USING (EXISTS (SELECT 1 FROM public."Official" p WHERE p.id = "OfficialAssignment"."officialId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Official" p WHERE p.id = "OfficialAssignment"."officialId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."MatchLineupRevision" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."MatchLineupRevision" FOR ALL USING (EXISTS (SELECT 1 FROM public."MatchLineup" p WHERE p.id = "MatchLineupRevision"."lineupId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."MatchLineup" p WHERE p.id = "MatchLineupRevision"."lineupId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."MatchEventRevision" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."MatchEventRevision" FOR ALL USING (EXISTS (SELECT 1 FROM public."MatchEvent" p WHERE p.id = "MatchEventRevision"."eventId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."MatchEvent" p WHERE p.id = "MatchEventRevision"."eventId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."MatchClockState" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."MatchClockState" FOR ALL USING (EXISTS (SELECT 1 FROM public."Match" p WHERE p.id = "MatchClockState"."matchId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Match" p WHERE p.id = "MatchClockState"."matchId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."InjuryProgress" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."InjuryProgress" FOR ALL USING (EXISTS (SELECT 1 FROM public."InjuryCase" p WHERE p.id = "InjuryProgress"."injuryId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."InjuryCase" p WHERE p.id = "InjuryProgress"."injuryId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."MedicalClearance" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."MedicalClearance" FOR ALL USING (EXISTS (SELECT 1 FROM public."InjuryCase" p WHERE p.id = "MedicalClearance"."injuryId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."InjuryCase" p WHERE p.id = "MedicalClearance"."injuryId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."DisciplinaryDecision" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."DisciplinaryDecision" FOR ALL USING (EXISTS (SELECT 1 FROM public."DisciplinaryCase" p WHERE p.id = "DisciplinaryDecision"."caseId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."DisciplinaryCase" p WHERE p.id = "DisciplinaryDecision"."caseId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."DisciplinaryAppeal" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."DisciplinaryAppeal" FOR ALL USING (EXISTS (SELECT 1 FROM public."DisciplinaryCase" p WHERE p.id = "DisciplinaryAppeal"."caseId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."DisciplinaryCase" p WHERE p.id = "DisciplinaryAppeal"."caseId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."SuspensionService" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."SuspensionService" FOR ALL USING (EXISTS (SELECT 1 FROM public."Suspension" p WHERE p.id = "SuspensionService"."suspensionId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."Suspension" p WHERE p.id = "SuspensionService"."suspensionId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."StandingsRow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."StandingsRow" FOR ALL USING (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "StandingsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "StandingsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."TeamStatisticsRow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."TeamStatisticsRow" FOR ALL USING (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "TeamStatisticsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "TeamStatisticsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."PlayerStatisticsRow" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."PlayerStatisticsRow" FOR ALL USING (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "PlayerStatisticsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "PlayerStatisticsRow"."snapshotId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."LeaderboardSnapshot" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."LeaderboardSnapshot" FOR ALL USING (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "LeaderboardSnapshot"."snapshotId" AND public.app_tenant_allowed(p."organizationId"))) WITH CHECK (EXISTS (SELECT 1 FROM public."StatisticsSnapshot" p WHERE p.id = "LeaderboardSnapshot"."snapshotId" AND public.app_tenant_allowed(p."organizationId")));
ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON public."RolePermission" FOR ALL USING (EXISTS (SELECT 1 FROM public."Role" p WHERE p.id = "RolePermission"."roleId" AND (public.app_tenant_allowed(p."organizationId") OR current_setting('app.platform_admin', true) = 'true'))) WITH CHECK (EXISTS (SELECT 1 FROM public."Role" p WHERE p.id = "RolePermission"."roleId" AND (public.app_tenant_allowed(p."organizationId") OR current_setting('app.platform_admin', true) = 'true')));
