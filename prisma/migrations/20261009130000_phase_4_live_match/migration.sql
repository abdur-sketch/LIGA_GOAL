-- Phase 4 keeps legacy events readable while backfilling tenant and period data.
-- CreateEnum
CREATE TYPE "MatchEventType" AS ENUM ('KICK_OFF', 'GOAL', 'ASSIST', 'OWN_GOAL', 'PENALTY_GOAL', 'PENALTY_MISSED', 'YELLOW_CARD', 'SECOND_YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'HALF_TIME', 'SECOND_HALF_KICK_OFF', 'FULL_TIME', 'EXTRA_TIME_START', 'EXTRA_TIME_END', 'SHOOTOUT_GOAL', 'SHOOTOUT_MISSED');

-- CreateEnum
CREATE TYPE "MatchPeriod" AS ENUM ('PRE_MATCH', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'EXTRA_TIME_FIRST', 'EXTRA_TIME_BREAK', 'EXTRA_TIME_SECOND', 'PENALTY_SHOOTOUT', 'FULL_TIME');

-- CreateEnum
CREATE TYPE "LineupStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "LineupRole" AS ENUM ('STARTER', 'SUBSTITUTE');

-- CreateEnum
CREATE TYPE "MatchApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchCorrectionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "RealtimeOutboxStatus" AS ENUM ('PENDING', 'PUBLISHED');

-- DropIndex
DROP INDEX "MatchEvent_matchId_isValid_minute_idx";

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "awayScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "homeScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shootoutAway" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shootoutHome" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MatchEvent" ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "operatorId" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "period" "MatchPeriod" NOT NULL DEFAULT 'FIRST_HALF',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MatchEvent" e
SET "organizationId" = m."organizationId"
FROM "Match" m
WHERE e."matchId" = m."id";

ALTER TABLE "MatchEvent"
ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "eventType" TYPE "MatchEventType"
USING (CASE
  WHEN "eventType" IN ('KICK_OFF','GOAL','ASSIST','OWN_GOAL','PENALTY_GOAL','PENALTY_MISSED','YELLOW_CARD','SECOND_YELLOW_CARD','RED_CARD','SUBSTITUTION','HALF_TIME','SECOND_HALF_KICK_OFF','FULL_TIME','EXTRA_TIME_START','EXTRA_TIME_END','SHOOTOUT_GOAL','SHOOTOUT_MISSED')
  THEN "eventType"
  ELSE 'GOAL'
END)::"MatchEventType";

ALTER TABLE "MatchEvent"
ALTER COLUMN "period" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "MatchLineup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "status" "LineupStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineupPlayer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "role" "LineupRole" NOT NULL,
    "shirtNumber" INTEGER NOT NULL,
    "position" TEXT,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isGoalkeeper" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchLineupPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchLineupRevision" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchLineupRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchEventRevision" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "actorId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEventRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "shootoutHome" INTEGER NOT NULL DEFAULT 0,
    "shootoutAway" INTEGER NOT NULL DEFAULT 0,
    "winnerTeamId" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "eventSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "MatchApprovalStatus" NOT NULL,
    "notes" TEXT,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCorrection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "MatchCorrectionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "MatchCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchClockState" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "period" "MatchPeriod" NOT NULL DEFAULT 'PRE_MATCH',
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchClockState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRealtimeOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "RealtimeOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "MatchRealtimeOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchLineup_organizationId_matchId_status_idx" ON "MatchLineup"("organizationId", "matchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineup_matchId_teamId_key" ON "MatchLineup"("matchId", "teamId");

-- CreateIndex
CREATE INDEX "MatchLineupPlayer_organizationId_matchId_teamId_idx" ON "MatchLineupPlayer"("organizationId", "matchId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupPlayer_matchId_playerId_key" ON "MatchLineupPlayer"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupPlayer_lineupId_shirtNumber_key" ON "MatchLineupPlayer"("lineupId", "shirtNumber");

-- CreateIndex
CREATE INDEX "MatchLineupRevision_lineupId_createdAt_idx" ON "MatchLineupRevision"("lineupId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchLineupRevision_lineupId_version_key" ON "MatchLineupRevision"("lineupId", "version");

-- CreateIndex
CREATE INDEX "MatchEventRevision_eventId_createdAt_idx" ON "MatchEventRevision"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchEventRevision_eventId_revision_key" ON "MatchEventRevision"("eventId", "revision");

-- CreateIndex
CREATE INDEX "MatchResult_organizationId_matchId_isCurrent_idx" ON "MatchResult"("organizationId", "matchId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_matchId_version_key" ON "MatchResult"("matchId", "version");

-- CreateIndex
CREATE INDEX "MatchApproval_organizationId_matchId_createdAt_idx" ON "MatchApproval"("organizationId", "matchId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchCorrection_organizationId_matchId_status_idx" ON "MatchCorrection"("organizationId", "matchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MatchClockState_matchId_key" ON "MatchClockState"("matchId");

-- CreateIndex
CREATE INDEX "MatchRealtimeOutbox_organizationId_matchId_sequence_idx" ON "MatchRealtimeOutbox"("organizationId", "matchId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRealtimeOutbox_matchId_sequence_key" ON "MatchRealtimeOutbox"("matchId", "sequence");

-- CreateIndex
CREATE INDEX "MatchEvent_organizationId_matchId_isValid_minute_addedTime_idx" ON "MatchEvent"("organizationId", "matchId", "isValid", "minute", "addedTime");

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineup" ADD CONSTRAINT "MatchLineup_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "MatchLineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupPlayer" ADD CONSTRAINT "MatchLineupPlayer_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PlayerRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupRevision" ADD CONSTRAINT "MatchLineupRevision_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "MatchLineup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchLineupRevision" ADD CONSTRAINT "MatchLineupRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_relatedPlayerId_fkey" FOREIGN KEY ("relatedPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEvent" ADD CONSTRAINT "MatchEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEventRevision" ADD CONSTRAINT "MatchEventRevision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MatchEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchEventRevision" ADD CONSTRAINT "MatchEventRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchApproval" ADD CONSTRAINT "MatchApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchApproval" ADD CONSTRAINT "MatchApproval_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchApproval" ADD CONSTRAINT "MatchApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCorrection" ADD CONSTRAINT "MatchCorrection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCorrection" ADD CONSTRAINT "MatchCorrection_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCorrection" ADD CONSTRAINT "MatchCorrection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCorrection" ADD CONSTRAINT "MatchCorrection_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchClockState" ADD CONSTRAINT "MatchClockState_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRealtimeOutbox" ADD CONSTRAINT "MatchRealtimeOutbox_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRealtimeOutbox" ADD CONSTRAINT "MatchRealtimeOutbox_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
