-- Fix the shared trigger's record-field dispatch for installations that applied
-- the initial Phase 19 migration. The nested branch prevents PostgreSQL from
-- resolving Competition-only fields for other trigger row types.
CREATE OR REPLACE FUNCTION public.phase19_validate_generic_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_org TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Competition' THEN
    IF NEW."parentCompetitionId" IS NOT NULL THEN
      SELECT "organizationId" INTO expected_org FROM "Competition" WHERE id=NEW."parentCompetitionId";
      IF expected_org IS DISTINCT FROM NEW."organizationId" THEN RAISE EXCEPTION 'parent competition belongs to another tenant'; END IF;
    END IF;
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
