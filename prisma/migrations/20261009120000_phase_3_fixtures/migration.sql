-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('ROUND_ROBIN', 'GROUP', 'KNOCKOUT');

-- CreateEnum
CREATE TYPE "DrawMethod" AS ENUM ('MANUAL', 'RANDOM', 'SEEDED');

-- CreateEnum
CREATE TYPE "FixtureGenerationStatus" AS ENUM ('DRAFT', 'PREVIEW', 'VALIDATED', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BracketSide" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "BracketTieStatus" AS ENUM ('PENDING', 'READY', 'COMPLETED');

-- Expand existing hierarchy with nullable tenant columns, backfill, then enforce constraints.
ALTER TABLE "Stage" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "format" "CompetitionFormat" NOT NULL DEFAULT 'SINGLE_ROUND_ROBIN',
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "type" "StageType" NOT NULL DEFAULT 'ROUND_ROBIN',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Stage" stage SET "organizationId" = competition."organizationId"
FROM "Season" season JOIN "Competition" competition ON competition."id" = season."competitionId"
WHERE stage."seasonId" = season."id";
ALTER TABLE "Stage" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Group" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Group" grouping SET "organizationId" = stage."organizationId" FROM "Stage" stage WHERE grouping."stageId" = stage."id";
ALTER TABLE "Group" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Match" ADD COLUMN "competitionId" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "fixtureDraftId" TEXT,
ADD COLUMN "matchNumber" INTEGER,
ADD COLUMN "organizationId" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "seasonId" TEXT,
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedById" TEXT,
ALTER COLUMN "kickoffAt" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

WITH ranked AS (
  SELECT match."id", season."id" AS "seasonId", competition."id" AS "competitionId", competition."organizationId",
    ROW_NUMBER() OVER (PARTITION BY season."id" ORDER BY match."kickoffAt" NULLS LAST, match."id")::INTEGER AS "matchNumber"
  FROM "Match" match
  JOIN "Stage" stage ON stage."id" = match."stageId"
  JOIN "Season" season ON season."id" = stage."seasonId"
  JOIN "Competition" competition ON competition."id" = season."competitionId"
)
UPDATE "Match" match SET "seasonId" = ranked."seasonId", "competitionId" = ranked."competitionId",
  "organizationId" = ranked."organizationId", "matchNumber" = ranked."matchNumber"
FROM ranked WHERE ranked."id" = match."id";
ALTER TABLE "Match" ALTER COLUMN "organizationId" SET NOT NULL, ALTER COLUMN "competitionId" SET NOT NULL,
  ALTER COLUMN "seasonId" SET NOT NULL, ALTER COLUMN "matchNumber" SET NOT NULL, ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "GroupMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureGeneration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "format" "CompetitionFormat" NOT NULL,
    "drawMethod" "DrawMethod" NOT NULL DEFAULT 'RANDOM',
    "config" JSONB NOT NULL,
    "status" "FixtureGenerationStatus" NOT NULL DEFAULT 'DRAFT',
    "fixtureCount" INTEGER NOT NULL DEFAULT 0,
    "roundCount" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixtureGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "groupId" TEXT,
    "round" INTEGER NOT NULL,
    "matchNumber" INTEGER NOT NULL,
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,
    "venueId" TEXT,
    "refereeId" TEXT,
    "kickoffAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixtureDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixturePublication" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "publishedById" TEXT NOT NULL,
    "fixtureCount" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixturePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchOfficialAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "officialId" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL DEFAULT 'REFEREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchOfficialAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchScheduleHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketTie" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "legs" INTEGER NOT NULL DEFAULT 1,
    "status" "BracketTieStatus" NOT NULL DEFAULT 'PENDING',
    "aggregateHome" INTEGER,
    "aggregateAway" INTEGER,
    "penaltyHome" INTEGER,
    "penaltyAway" INTEGER,
    "winnerTeamId" TEXT,
    "matchId" TEXT,
    "nextTieId" TEXT,
    "nextSide" "BracketSide",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BracketTie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketSlot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tieId" TEXT NOT NULL,
    "side" "BracketSide" NOT NULL,
    "clubId" TEXT,
    "seed" INTEGER,
    "sourceTieId" TEXT,
    "sourceLabel" TEXT,

    CONSTRAINT "BracketSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupMembership_organizationId_groupId_idx" ON "GroupMembership"("organizationId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_stageId_clubId_key" ON "GroupMembership"("stageId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMembership_groupId_clubId_key" ON "GroupMembership"("groupId", "clubId");

-- CreateIndex
CREATE INDEX "FixtureGeneration_organizationId_seasonId_status_idx" ON "FixtureGeneration"("organizationId", "seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureGeneration_organizationId_idempotencyKey_key" ON "FixtureGeneration"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FixtureDraft_organizationId_stageId_round_idx" ON "FixtureDraft"("organizationId", "stageId", "round");

-- CreateIndex
CREATE INDEX "FixtureDraft_venueId_kickoffAt_idx" ON "FixtureDraft"("venueId", "kickoffAt");

-- CreateIndex
CREATE INDEX "FixtureDraft_refereeId_kickoffAt_idx" ON "FixtureDraft"("refereeId", "kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureDraft_generationId_matchNumber_key" ON "FixtureDraft"("generationId", "matchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FixturePublication_generationId_key" ON "FixturePublication"("generationId");

-- CreateIndex
CREATE INDEX "FixturePublication_organizationId_publishedAt_idx" ON "FixturePublication"("organizationId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FixturePublication_organizationId_idempotencyKey_key" ON "FixturePublication"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MatchOfficialAssignment_organizationId_officialId_idx" ON "MatchOfficialAssignment"("organizationId", "officialId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchOfficialAssignment_matchId_officialId_role_key" ON "MatchOfficialAssignment"("matchId", "officialId", "role");

-- CreateIndex
CREATE INDEX "MatchScheduleHistory_organizationId_matchId_createdAt_idx" ON "MatchScheduleHistory"("organizationId", "matchId", "createdAt");

-- CreateIndex
CREATE INDEX "BracketTie_organizationId_stageId_round_idx" ON "BracketTie"("organizationId", "stageId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "BracketTie_stageId_round_position_key" ON "BracketTie"("stageId", "round", "position");

-- CreateIndex
CREATE INDEX "BracketSlot_organizationId_clubId_idx" ON "BracketSlot"("organizationId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketSlot_tieId_side_key" ON "BracketSlot"("tieId", "side");

-- CreateIndex
CREATE INDEX "Group_organizationId_stageId_idx" ON "Group"("organizationId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_fixtureDraftId_key" ON "Match"("fixtureDraftId");

-- CreateIndex
CREATE INDEX "Match_organizationId_competitionId_seasonId_status_kickoffA_idx" ON "Match"("organizationId", "competitionId", "seasonId", "status", "kickoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_seasonId_matchNumber_key" ON "Match"("seasonId", "matchNumber");

-- CreateIndex
CREATE INDEX "Stage_organizationId_seasonId_type_idx" ON "Stage"("organizationId", "seasonId", "type");

-- AddForeignKey
ALTER TABLE "Stage" ADD CONSTRAINT "Stage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMembership" ADD CONSTRAINT "GroupMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_fixtureDraftId_fkey" FOREIGN KEY ("fixtureDraftId") REFERENCES "FixtureDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureGeneration" ADD CONSTRAINT "FixtureGeneration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureGeneration" ADD CONSTRAINT "FixtureGeneration_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureGeneration" ADD CONSTRAINT "FixtureGeneration_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureGeneration" ADD CONSTRAINT "FixtureGeneration_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureGeneration" ADD CONSTRAINT "FixtureGeneration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "FixtureGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_homeClubId_fkey" FOREIGN KEY ("homeClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_awayClubId_fkey" FOREIGN KEY ("awayClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureDraft" ADD CONSTRAINT "FixtureDraft_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Official"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixturePublication" ADD CONSTRAINT "FixturePublication_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixturePublication" ADD CONSTRAINT "FixturePublication_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "FixtureGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixturePublication" ADD CONSTRAINT "FixturePublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficialAssignment" ADD CONSTRAINT "MatchOfficialAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficialAssignment" ADD CONSTRAINT "MatchOfficialAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOfficialAssignment" ADD CONSTRAINT "MatchOfficialAssignment_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScheduleHistory" ADD CONSTRAINT "MatchScheduleHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScheduleHistory" ADD CONSTRAINT "MatchScheduleHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchScheduleHistory" ADD CONSTRAINT "MatchScheduleHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketTie" ADD CONSTRAINT "BracketTie_nextTieId_fkey" FOREIGN KEY ("nextTieId") REFERENCES "BracketTie"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_tieId_fkey" FOREIGN KEY ("tieId") REFERENCES "BracketTie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketSlot" ADD CONSTRAINT "BracketSlot_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;
