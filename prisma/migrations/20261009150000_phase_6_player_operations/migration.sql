-- CreateEnum
CREATE TYPE "TransferType" AS ENUM ('PERMANENT', 'LOAN', 'LOAN_RETURN', 'FREE_AGENT_SIGNING', 'REGISTRATION_RELEASE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SOURCE_CLUB_APPROVED', 'DESTINATION_CLUB_APPROVED', 'COMPETITION_APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransferApprovalStep" AS ENUM ('SOURCE_CLUB', 'DESTINATION_CLUB', 'COMPETITION', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "TransferApprovalStatus" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TransferWindowStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('OPEN', 'RECOVERING', 'CLEARED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('APPROVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DisciplinaryCaseStatus" AS ENUM ('OPEN', 'DECIDED', 'APPEALED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisciplinaryDecisionType" AS ENUM ('WARNING', 'MATCH_BAN', 'DATE_SUSPENSION', 'POINT_PENALTY', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SuspensionType" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "SuspensionStatus" AS ENUM ('ACTIVE', 'SERVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('NONE', 'PENDING', 'UPHELD', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'VIEW';

-- DropIndex
DROP INDEX "PlayerRegistration_seasonId_playerId_key";

-- DropIndex
DROP INDEX "PlayerAvailability_playerId_startsAt_idx";

-- AlterTable
-- Add tenant-aware fields in two steps so existing Phase 2 availability rows
-- can be retained during an upgrade.
ALTER TABLE "PlayerAvailability" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "publicApproved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

UPDATE "PlayerAvailability" availability
SET "organizationId" = player."organizationId",
    "reason" = COALESCE(NULLIF(availability."publicNote", ''), 'Status availability hasil migrasi')
FROM "Player" player
WHERE player."id" = availability."playerId";

ALTER TABLE "PlayerAvailability"
ALTER COLUMN "organizationId" SET NOT NULL,
ALTER COLUMN "reason" SET NOT NULL;

-- CreateTable
CREATE TABLE "TransferWindow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "registrationDeadline" TIMESTAMP(3),
    "status" "TransferWindowStatus" NOT NULL DEFAULT 'OPEN',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sourceClubId" TEXT,
    "destinationClubId" TEXT,
    "transferWindowId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "type" "TransferType" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveAt" TIMESTAMP(3),
    "supportingDocs" JSONB NOT NULL DEFAULT '[]',
    "rejectionReason" TEXT,
    "overrideReason" TEXT,
    "overrideById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "step" "TransferApprovalStep" NOT NULL,
    "status" "TransferApprovalStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "TransferStatus",
    "toStatus" "TransferStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InjuryCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "status" "InjuryStatus" NOT NULL DEFAULT 'OPEN',
    "injuryDate" TIMESTAMP(3) NOT NULL,
    "estimatedReturn" TIMESTAMP(3),
    "actualReturn" TIMESTAMP(3),
    "diagnosis" TEXT,
    "medicalNotes" TEXT,
    "publicNote" TEXT,
    "publicApproved" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InjuryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InjuryProgress" (
    "id" TEXT NOT NULL,
    "injuryId" TEXT NOT NULL,
    "status" "InjuryStatus" NOT NULL,
    "privateNotes" TEXT,
    "publicNote" TEXT,
    "actorId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InjuryProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalClearance" (
    "id" TEXT NOT NULL,
    "injuryId" TEXT NOT NULL,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'APPROVED',
    "clearedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalClearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "matchId" TEXT,
    "eventId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "cardType" "MatchEventType",
    "status" "DisciplinaryCaseStatus" NOT NULL DEFAULT 'OPEN',
    "summary" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryDecision" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "DisciplinaryDecisionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "matchBans" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "pointPenalty" INTEGER,
    "approvedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisciplinaryAppeal" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DisciplinaryAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suspension" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "disciplinaryCaseId" TEXT,
    "type" "SuspensionType" NOT NULL,
    "status" "SuspensionStatus" NOT NULL DEFAULT 'ACTIVE',
    "appealStatus" "AppealStatus" NOT NULL DEFAULT 'NONE',
    "reason" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "originalMatchBans" INTEGER,
    "remainingMatchBans" INTEGER,
    "issuedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspensionService" (
    "id" TEXT NOT NULL,
    "suspensionId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspensionService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferWindow_organizationId_competitionId_seasonId_status_idx" ON "TransferWindow"("organizationId", "competitionId", "seasonId", "status", "opensAt", "closesAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransferWindow_seasonId_name_key" ON "TransferWindow"("seasonId", "name");

-- CreateIndex
CREATE INDEX "TransferRequest_organizationId_competitionId_seasonId_statu_idx" ON "TransferRequest"("organizationId", "competitionId", "seasonId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "TransferRequest_playerId_seasonId_status_idx" ON "TransferRequest"("playerId", "seasonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransferRequest_organizationId_idempotencyKey_key" ON "TransferRequest"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferApproval_organizationId_transferId_createdAt_idx" ON "TransferApproval"("organizationId", "transferId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransferApproval_transferId_step_key" ON "TransferApproval"("transferId", "step");

-- CreateIndex
CREATE INDEX "TransferHistory_organizationId_transferId_createdAt_idx" ON "TransferHistory"("organizationId", "transferId", "createdAt");

-- CreateIndex
CREATE INDEX "InjuryCase_organizationId_playerId_status_injuryDate_idx" ON "InjuryCase"("organizationId", "playerId", "status", "injuryDate");

-- CreateIndex
CREATE INDEX "InjuryProgress_injuryId_recordedAt_idx" ON "InjuryProgress"("injuryId", "recordedAt");

-- CreateIndex
CREATE INDEX "MedicalClearance_injuryId_clearedAt_idx" ON "MedicalClearance"("injuryId", "clearedAt");

-- CreateIndex
CREATE INDEX "DisciplinaryCase_organizationId_competitionId_seasonId_play_idx" ON "DisciplinaryCase"("organizationId", "competitionId", "seasonId", "playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DisciplinaryCase_organizationId_sourceKey_key" ON "DisciplinaryCase"("organizationId", "sourceKey");

-- CreateIndex
CREATE INDEX "DisciplinaryDecision_caseId_createdAt_idx" ON "DisciplinaryDecision"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "DisciplinaryAppeal_caseId_status_createdAt_idx" ON "DisciplinaryAppeal"("caseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Suspension_organizationId_competitionId_seasonId_playerId_s_idx" ON "Suspension"("organizationId", "competitionId", "seasonId", "playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Suspension_organizationId_sourceKey_key" ON "Suspension"("organizationId", "sourceKey");

-- CreateIndex
CREATE INDEX "SuspensionService_matchId_idx" ON "SuspensionService"("matchId");

-- CreateIndex
CREATE UNIQUE INDEX "SuspensionService_suspensionId_matchId_key" ON "SuspensionService"("suspensionId", "matchId");

-- CreateIndex
CREATE INDEX "PlayerRegistration_seasonId_playerId_status_idx" ON "PlayerRegistration"("seasonId", "playerId", "status");

-- CreateIndex
CREATE INDEX "PlayerAvailability_organizationId_playerId_startsAt_endsAt_idx" ON "PlayerAvailability"("organizationId", "playerId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PlayerAvailability_sourceType_sourceId_idx" ON "PlayerAvailability"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAvailability_sourceType_sourceId_key" ON "PlayerAvailability"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "TransferWindow" ADD CONSTRAINT "TransferWindow_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferWindow" ADD CONSTRAINT "TransferWindow_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferWindow" ADD CONSTRAINT "TransferWindow_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferWindow" ADD CONSTRAINT "TransferWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_sourceClubId_fkey" FOREIGN KEY ("sourceClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_destinationClubId_fkey" FOREIGN KEY ("destinationClubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_transferWindowId_fkey" FOREIGN KEY ("transferWindowId") REFERENCES "TransferWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferRequest" ADD CONSTRAINT "TransferRequest_overrideById_fkey" FOREIGN KEY ("overrideById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TransferRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferApproval" ADD CONSTRAINT "TransferApproval_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TransferRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferHistory" ADD CONSTRAINT "TransferHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryCase" ADD CONSTRAINT "InjuryCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryCase" ADD CONSTRAINT "InjuryCase_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryCase" ADD CONSTRAINT "InjuryCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryProgress" ADD CONSTRAINT "InjuryProgress_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "InjuryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InjuryProgress" ADD CONSTRAINT "InjuryProgress_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalClearance" ADD CONSTRAINT "MedicalClearance_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "InjuryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalClearance" ADD CONSTRAINT "MedicalClearance_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MatchEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryDecision" ADD CONSTRAINT "DisciplinaryDecision_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryDecision" ADD CONSTRAINT "DisciplinaryDecision_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryAppeal" ADD CONSTRAINT "DisciplinaryAppeal_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisciplinaryAppeal" ADD CONSTRAINT "DisciplinaryAppeal_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_disciplinaryCaseId_fkey" FOREIGN KEY ("disciplinaryCaseId") REFERENCES "DisciplinaryCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suspension" ADD CONSTRAINT "Suspension_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionService" ADD CONSTRAINT "SuspensionService_suspensionId_fkey" FOREIGN KEY ("suspensionId") REFERENCES "Suspension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspensionService" ADD CONSTRAINT "SuspensionService_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
