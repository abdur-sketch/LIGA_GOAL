-- Phase 2 preserves existing players and registration history while expanding the workflow.
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED', 'ARCHIVED');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');
CREATE TYPE "PreferredFoot" AS ENUM ('LEFT', 'RIGHT', 'BOTH');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "EligibilityResult" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'PENDING_REVIEW');
CREATE TYPE "PlayerDocumentType" AS ENUM ('PHOTO', 'IDENTITY', 'AGE_PROOF', 'PARENTAL_CONSENT', 'ADDITIONAL');
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "RosterStatus" AS ENUM ('ACTIVE', 'INACTIVE');

BEGIN;
CREATE TYPE "RegistrationStatus_new" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CANCELLED');
ALTER TABLE "PlayerRegistration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PlayerRegistration" ALTER COLUMN "status" TYPE "RegistrationStatus_new"
  USING (CASE WHEN "status"::text = 'VERIFIED' THEN 'APPROVED' ELSE "status"::text END)::"RegistrationStatus_new";
ALTER TYPE "RegistrationStatus" RENAME TO "RegistrationStatus_old";
ALTER TYPE "RegistrationStatus_new" RENAME TO "RegistrationStatus";
DROP TYPE "RegistrationStatus_old";
ALTER TABLE "PlayerRegistration" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

ALTER TABLE "Player" RENAME COLUMN "position" TO "primaryPosition";
ALTER TABLE "Player"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "nationality" TEXT,
  ADD COLUMN "placeOfBirth" TEXT,
  ADD COLUMN "preferredFoot" "PreferredFoot",
  ADD COLUMN "secondaryPositions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "weightKg" DOUBLE PRECISION;

ALTER TABLE "PlayerRegistration" RENAME COLUMN "shirtNumber" TO "jerseyNumber";
ALTER TABLE "PlayerRegistration"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "clubId" TEXT,
  ADD COLUMN "competitionId" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "eligibilityStatus" "EligibilityResult" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING';

UPDATE "PlayerRegistration" registration
SET "competitionId" = season."competitionId",
    "organizationId" = competition."organizationId",
    "clubId" = team."clubId",
    "idempotencyKey" = 'legacy:' || registration."id"
FROM "Season" season
JOIN "Competition" competition ON competition."id" = season."competitionId"
JOIN "Team" team ON team."competitionId" = competition."id"
WHERE registration."seasonId" = season."id" AND registration."teamId" = team."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PlayerRegistration" WHERE "organizationId" IS NULL OR "competitionId" IS NULL OR "clubId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot migrate registration with invalid season/team references';
  END IF;
END $$;

DROP INDEX "PlayerRegistration_teamId_status_idx";
ALTER TABLE "PlayerRegistration"
  ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "competitionId" SET NOT NULL,
  ALTER COLUMN "clubId" SET NOT NULL,
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  DROP COLUMN "teamId";

CREATE TABLE "PlayerPrivateProfile" (
  "id" TEXT NOT NULL, "playerId" TEXT NOT NULL, "legalFullName" TEXT, "address" TEXT,
  "guardianName" TEXT, "guardianContact" TEXT, "identityLastFour" TEXT, "privateNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerPrivateProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerDocument" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "playerId" TEXT NOT NULL, "registrationId" TEXT,
  "type" "PlayerDocumentType" NOT NULL, "label" TEXT, "storageKey" TEXT NOT NULL, "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true, "required" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING', "rejectionNotes" TEXT,
  "replacedDocumentId" TEXT, "uploadedById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "PlayerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlayerDocumentVerification" (
  "id" TEXT NOT NULL, "documentId" TEXT NOT NULL, "verifierId" TEXT NOT NULL,
  "status" "DocumentVerificationStatus" NOT NULL, "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerDocumentVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RosterEntry" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "seasonId" TEXT NOT NULL, "clubId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL, "jerseyNumber" INTEGER, "position" TEXT, "status" "RosterStatus" NOT NULL DEFAULT 'ACTIVE',
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "releasedAt" TIMESTAMP(3),
  CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegistrationHistory" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "registrationId" TEXT NOT NULL, "actorId" TEXT,
  "fromStatus" "RegistrationStatus", "toStatus" "RegistrationStatus" NOT NULL, "action" TEXT NOT NULL,
  "reason" TEXT, "snapshot" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegistrationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EligibilityCheck" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "registrationId" TEXT NOT NULL,
  "result" "EligibilityResult" NOT NULL, "reasons" JSONB NOT NULL, "ruleSnapshot" JSONB NOT NULL,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EligibilityCheck_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerPrivateProfile_playerId_key" ON "PlayerPrivateProfile"("playerId");
CREATE UNIQUE INDEX "PlayerDocument_storageKey_key" ON "PlayerDocument"("storageKey");
CREATE INDEX "PlayerDocument_organizationId_playerId_type_isCurrent_idx" ON "PlayerDocument"("organizationId", "playerId", "type", "isCurrent");
CREATE INDEX "PlayerDocument_registrationId_verificationStatus_idx" ON "PlayerDocument"("registrationId", "verificationStatus");
CREATE INDEX "PlayerDocumentVerification_documentId_createdAt_idx" ON "PlayerDocumentVerification"("documentId", "createdAt");
CREATE UNIQUE INDEX "RosterEntry_registrationId_key" ON "RosterEntry"("registrationId");
CREATE INDEX "RosterEntry_organizationId_seasonId_clubId_status_idx" ON "RosterEntry"("organizationId", "seasonId", "clubId", "status");
CREATE INDEX "RosterEntry_seasonId_clubId_jerseyNumber_status_idx" ON "RosterEntry"("seasonId", "clubId", "jerseyNumber", "status");
CREATE INDEX "RegistrationHistory_registrationId_createdAt_idx" ON "RegistrationHistory"("registrationId", "createdAt");
CREATE INDEX "RegistrationHistory_organizationId_createdAt_idx" ON "RegistrationHistory"("organizationId", "createdAt");
CREATE INDEX "EligibilityCheck_registrationId_checkedAt_idx" ON "EligibilityCheck"("registrationId", "checkedAt");
CREATE INDEX "EligibilityCheck_organizationId_result_checkedAt_idx" ON "EligibilityCheck"("organizationId", "result", "checkedAt");
CREATE INDEX "PlayerRegistration_organizationId_competitionId_seasonId_clubId_status_idx" ON "PlayerRegistration"("organizationId", "competitionId", "seasonId", "clubId", "status");
CREATE INDEX "PlayerRegistration_playerId_registrationDate_idx" ON "PlayerRegistration"("playerId", "registrationDate");
CREATE UNIQUE INDEX "PlayerRegistration_organizationId_idempotencyKey_key" ON "PlayerRegistration"("organizationId", "idempotencyKey");

ALTER TABLE "Player" ADD CONSTRAINT "Player_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerPrivateProfile" ADD CONSTRAINT "PlayerPrivateProfile_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerRegistration" ADD CONSTRAINT "PlayerRegistration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerRegistration" ADD CONSTRAINT "PlayerRegistration_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerRegistration" ADD CONSTRAINT "PlayerRegistration_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerRegistration" ADD CONSTRAINT "PlayerRegistration_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PlayerRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocument" ADD CONSTRAINT "PlayerDocument_replacedDocumentId_fkey" FOREIGN KEY ("replacedDocumentId") REFERENCES "PlayerDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocumentVerification" ADD CONSTRAINT "PlayerDocumentVerification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlayerDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerDocumentVerification" ADD CONSTRAINT "PlayerDocumentVerification_verifierId_fkey" FOREIGN KEY ("verifierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PlayerRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationHistory" ADD CONSTRAINT "RegistrationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationHistory" ADD CONSTRAINT "RegistrationHistory_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PlayerRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RegistrationHistory" ADD CONSTRAINT "RegistrationHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "PlayerRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
