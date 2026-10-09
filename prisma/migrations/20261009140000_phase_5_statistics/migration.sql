-- CreateEnum
CREATE TYPE "StatisticsSnapshotStatus" AS ENUM ('BUILDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "StatisticsJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StandingResolutionStatus" AS ENUM ('RESOLVED', 'UNRESOLVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "QualificationStatus" AS ENUM ('UNDECIDED', 'QUALIFIED', 'ELIMINATED');

-- CreateTable
CREATE TABLE "StatisticsSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "stageId" TEXT,
    "groupId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "sourceResultVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "StatisticsSnapshotStatus" NOT NULL DEFAULT 'BUILDING',
    "errorMessage" TEXT,
    "computedById" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatisticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingsRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalDifference" INTEGER NOT NULL,
    "rawPoints" INTEGER NOT NULL,
    "adjustmentPoints" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL,
    "fairPlayPoints" INTEGER NOT NULL DEFAULT 0,
    "form" JSONB NOT NULL DEFAULT '[]',
    "resolutionStatus" "StandingResolutionStatus" NOT NULL DEFAULT 'RESOLVED',
    "qualificationStatus" "QualificationStatus" NOT NULL DEFAULT 'UNDECIDED',

    CONSTRAINT "StandingsRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamStatisticsRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "played" INTEGER NOT NULL,
    "won" INTEGER NOT NULL,
    "drawn" INTEGER NOT NULL,
    "lost" INTEGER NOT NULL,
    "goalsFor" INTEGER NOT NULL,
    "goalsAgainst" INTEGER NOT NULL,
    "goalDifference" INTEGER NOT NULL,
    "cleanSheets" INTEGER NOT NULL,
    "homePlayed" INTEGER NOT NULL,
    "homeWon" INTEGER NOT NULL,
    "homeDrawn" INTEGER NOT NULL,
    "homeLost" INTEGER NOT NULL,
    "awayPlayed" INTEGER NOT NULL,
    "awayWon" INTEGER NOT NULL,
    "awayDrawn" INTEGER NOT NULL,
    "awayLost" INTEGER NOT NULL,
    "longestWinStreak" INTEGER NOT NULL,
    "longestUnbeatenStreak" INTEGER NOT NULL,
    "currentForm" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "TeamStatisticsRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerStatisticsRow" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "appearances" INTEGER NOT NULL,
    "starts" INTEGER NOT NULL,
    "minutesPlayed" INTEGER,
    "goals" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "ownGoals" INTEGER NOT NULL,
    "penaltyGoals" INTEGER NOT NULL,
    "penaltyMisses" INTEGER NOT NULL,
    "yellowCards" INTEGER NOT NULL,
    "secondYellowCards" INTEGER NOT NULL,
    "redCards" INTEGER NOT NULL,
    "cleanSheets" INTEGER,

    CONSTRAINT "PlayerStatisticsRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "entries" JSONB NOT NULL,
    "tieBreakers" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "stageId" TEXT,
    "groupId" TEXT,
    "clubId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatisticsRecomputeJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "StatisticsJobStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL,
    "sourceMatchId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatisticsRecomputeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatisticsRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatisticsRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatisticsSnapshot_organizationId_scopeKey_status_published_idx" ON "StatisticsSnapshot"("organizationId", "scopeKey", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "StatisticsSnapshot_competitionId_seasonId_stageId_groupId_idx" ON "StatisticsSnapshot"("competitionId", "seasonId", "stageId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "StatisticsSnapshot_organizationId_scopeKey_version_key" ON "StatisticsSnapshot"("organizationId", "scopeKey", "version");

-- CreateIndex
CREATE INDEX "StandingsRow_clubId_snapshotId_idx" ON "StandingsRow"("clubId", "snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "StandingsRow_snapshotId_clubId_key" ON "StandingsRow"("snapshotId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "StandingsRow_snapshotId_position_key" ON "StandingsRow"("snapshotId", "position");

-- CreateIndex
CREATE INDEX "TeamStatisticsRow_clubId_snapshotId_idx" ON "TeamStatisticsRow"("clubId", "snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamStatisticsRow_snapshotId_clubId_key" ON "TeamStatisticsRow"("snapshotId", "clubId");

-- CreateIndex
CREATE INDEX "PlayerStatisticsRow_snapshotId_goals_assists_idx" ON "PlayerStatisticsRow"("snapshotId", "goals", "assists");

-- CreateIndex
CREATE INDEX "PlayerStatisticsRow_playerId_clubId_idx" ON "PlayerStatisticsRow"("playerId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStatisticsRow_snapshotId_playerId_clubId_key" ON "PlayerStatisticsRow"("snapshotId", "playerId", "clubId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_snapshotId_metric_key" ON "LeaderboardSnapshot"("snapshotId", "metric");

-- CreateIndex
CREATE INDEX "PointAdjustment_organizationId_competitionId_seasonId_stage_idx" ON "PointAdjustment"("organizationId", "competitionId", "seasonId", "stageId", "groupId", "clubId");

-- CreateIndex
CREATE INDEX "StatisticsRecomputeJob_organizationId_status_createdAt_idx" ON "StatisticsRecomputeJob"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StatisticsRecomputeJob_organizationId_idempotencyKey_key" ON "StatisticsRecomputeJob"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StatisticsRevision_organizationId_snapshotId_createdAt_idx" ON "StatisticsRevision"("organizationId", "snapshotId", "createdAt");

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsSnapshot" ADD CONSTRAINT "StatisticsSnapshot_computedById_fkey" FOREIGN KEY ("computedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingsRow" ADD CONSTRAINT "StandingsRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatisticsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingsRow" ADD CONSTRAINT "StandingsRow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStatisticsRow" ADD CONSTRAINT "TeamStatisticsRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatisticsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamStatisticsRow" ADD CONSTRAINT "TeamStatisticsRow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStatisticsRow" ADD CONSTRAINT "PlayerStatisticsRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatisticsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStatisticsRow" ADD CONSTRAINT "PlayerStatisticsRow_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStatisticsRow" ADD CONSTRAINT "PlayerStatisticsRow_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatisticsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointAdjustment" ADD CONSTRAINT "PointAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRecomputeJob" ADD CONSTRAINT "StatisticsRecomputeJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRecomputeJob" ADD CONSTRAINT "StatisticsRecomputeJob_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRecomputeJob" ADD CONSTRAINT "StatisticsRecomputeJob_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRevision" ADD CONSTRAINT "StatisticsRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRevision" ADD CONSTRAINT "StatisticsRevision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StatisticsSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatisticsRevision" ADD CONSTRAINT "StatisticsRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
