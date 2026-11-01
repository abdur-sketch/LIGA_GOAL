-- Phase 20 defense-in-depth for generic competition relations. This migration
-- is additive: it validates existing rows, then strengthens trigger guards.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "CompetitionSessionEntry" se
    JOIN "CompetitionSession" s ON s.id = se."sessionId"
    JOIN "GenericCompetitionEntry" e ON e.id = se."entryId"
    WHERE e."organizationId" <> s."organizationId"
       OR e."competitionId" <> s."competitionId"
  ) THEN
    RAISE EXCEPTION 'phase 20 preflight: invalid cross-boundary session entry exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GenericScoreEntry" score
    LEFT JOIN "CompetitionSessionEntry" se
      ON se."sessionId" = score."sessionId" AND se."entryId" = score."entryId"
    WHERE se."sessionId" IS NULL
  ) THEN
    RAISE EXCEPTION 'phase 20 preflight: score exists for an entry outside its session';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GenericResult" result
    LEFT JOIN "CompetitionSessionEntry" se
      ON se."sessionId" = result."sessionId" AND se."entryId" = result."entryId"
    WHERE result."sessionId" IS NOT NULL AND se."sessionId" IS NULL
  ) THEN
    RAISE EXCEPTION 'phase 20 preflight: session result exists for an entry outside its session';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.phase19_validate_generic_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Competition' THEN
    IF NEW."parentCompetitionId" IS NOT NULL THEN
      SELECT c."organizationId" INTO expected_org
      FROM "Competition" c
      JOIN "CompetitionProfile" profile ON profile."competitionId" = c.id
      WHERE c.id = NEW."parentCompetitionId" AND profile.kind = 'FESTIVAL';
      IF expected_org IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION 'parent competition must be a festival in the same tenant';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'GenericCompetitionEntry' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId")
      OR NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" WHERE id=NEW."participantId" AND "organizationId"=NEW."organizationId")
      OR (NEW."seasonId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Season" s JOIN "Competition" c ON c.id=s."competitionId" WHERE s.id=NEW."seasonId" AND c.id=NEW."competitionId" AND c."organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'generic entry tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'CompetitionSession' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId")
      OR (NEW."seasonId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Season" s WHERE s.id=NEW."seasonId" AND s."competitionId"=NEW."competitionId"))
      OR (NEW."stageId" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "Stage" stage
        JOIN "Season" season ON season.id=stage."seasonId"
        WHERE stage.id=NEW."stageId" AND stage."organizationId"=NEW."organizationId" AND season."competitionId"=NEW."competitionId"
      ))
      OR (NEW."venueId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Venue" WHERE id=NEW."venueId" AND "organizationId"=NEW."organizationId"))
    THEN RAISE EXCEPTION 'competition session tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'CompetitionSessionEntry' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "CompetitionSession" s
      JOIN "GenericCompetitionEntry" e ON e.id=NEW."entryId"
      WHERE s.id=NEW."sessionId"
        AND e."organizationId"=s."organizationId"
        AND e."competitionId"=s."competitionId"
    ) THEN RAISE EXCEPTION 'session entry tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'ScoringCriterion' THEN
    IF NOT EXISTS (SELECT 1 FROM "Competition" WHERE id=NEW."competitionId" AND "organizationId"=NEW."organizationId") THEN RAISE EXCEPTION 'criterion tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'GenericScoreEntry' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "CompetitionSession" s
      JOIN "GenericCompetitionEntry" e ON e.id=NEW."entryId"
      JOIN "CompetitionSessionEntry" se ON se."sessionId"=s.id AND se."entryId"=e.id
      WHERE s.id=NEW."sessionId"
        AND s."organizationId"=NEW."organizationId"
        AND e."organizationId"=NEW."organizationId"
        AND e."competitionId"=s."competitionId"
    ) OR (NEW."criterionId" IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM "ScoringCriterion" c
      JOIN "CompetitionSession" s ON s."competitionId"=c."competitionId"
      WHERE c.id=NEW."criterionId" AND s.id=NEW."sessionId" AND c."organizationId"=NEW."organizationId"
    )) THEN RAISE EXCEPTION 'generic score tenant boundary violation'; END IF;
  ELSIF TG_TABLE_NAME = 'GenericResult' THEN
    IF NOT EXISTS (SELECT 1 FROM "GenericCompetitionEntry" e WHERE e.id=NEW."entryId" AND e."organizationId"=NEW."organizationId" AND e."competitionId"=NEW."competitionId")
      OR (NEW."sessionId" IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM "CompetitionSession" s
        JOIN "CompetitionSessionEntry" se ON se."sessionId"=s.id AND se."entryId"=NEW."entryId"
        WHERE s.id=NEW."sessionId" AND s."organizationId"=NEW."organizationId" AND s."competitionId"=NEW."competitionId"
      ))
    THEN RAISE EXCEPTION 'generic result tenant boundary violation'; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS phase20_session_entry_guard ON "CompetitionSessionEntry";
CREATE TRIGGER phase20_session_entry_guard
BEFORE INSERT OR UPDATE ON "CompetitionSessionEntry"
FOR EACH ROW EXECUTE FUNCTION public.phase19_validate_generic_tenant();

-- Public requests historically use a platform-capable context so legacy
-- football DALs can apply their publication predicates. Phase 19 tables have
-- explicit public policies, therefore their tenant policies must never accept
-- that legacy bypass while access_mode is public.
DROP POLICY phase19_profile_tenant ON "CompetitionProfile";
CREATE POLICY phase19_profile_tenant ON "CompetitionProfile" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND EXISTS (
  SELECT 1 FROM "Competition" c
  WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId")
))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND EXISTS (
  SELECT 1 FROM "Competition" c
  WHERE c.id="CompetitionProfile"."competitionId" AND public.app_tenant_allowed(c."organizationId")
));

DROP POLICY phase19_participant_tenant ON "CompetitionParticipant";
CREATE POLICY phase19_participant_tenant ON "CompetitionParticipant" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));

DROP POLICY phase19_entry_tenant ON "GenericCompetitionEntry";
CREATE POLICY phase19_entry_tenant ON "GenericCompetitionEntry" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));

DROP POLICY phase19_session_tenant ON "CompetitionSession";
CREATE POLICY phase19_session_tenant ON "CompetitionSession" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));

DROP POLICY phase19_session_entry_tenant ON "CompetitionSessionEntry";
CREATE POLICY phase19_session_entry_tenant ON "CompetitionSessionEntry" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND EXISTS (
  SELECT 1 FROM "CompetitionSession" s
  WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId")
))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND EXISTS (
  SELECT 1 FROM "CompetitionSession" s
  WHERE s.id="CompetitionSessionEntry"."sessionId" AND public.app_tenant_allowed(s."organizationId")
));

DROP POLICY phase19_criterion_tenant ON "ScoringCriterion";
CREATE POLICY phase19_criterion_tenant ON "ScoringCriterion" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));

DROP POLICY phase19_score_tenant ON "GenericScoreEntry";
CREATE POLICY phase19_score_tenant ON "GenericScoreEntry" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));

DROP POLICY phase19_result_tenant ON "GenericResult";
CREATE POLICY phase19_result_tenant ON "GenericResult" FOR ALL
USING (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"))
WITH CHECK (current_setting('app.access_mode',true) <> 'public' AND public.app_tenant_allowed("organizationId"));
