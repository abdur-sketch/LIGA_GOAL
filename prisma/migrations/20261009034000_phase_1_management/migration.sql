-- Phase 1 expands existing identities without deleting historical records.
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ParticipationStatus" AS ENUM ('PENDING', 'APPROVED', 'WITHDRAWN');
CREATE TYPE "VenueStatus" AS ENUM ('AVAILABLE', 'MAINTENANCE', 'INACTIVE');
CREATE TYPE "OfficialRole" AS ENUM ('HEAD_COACH', 'ASSISTANT_COACH', 'CLUB_MANAGER', 'REFEREE', 'ASSISTANT_REFEREE', 'MATCH_COMMISSIONER', 'OTHER');

-- Preserve any existing ACTIVE competition by mapping it to ONGOING.
BEGIN;
CREATE TYPE "CompetitionStatus_new" AS ENUM ('DRAFT', 'REGISTRATION', 'ONGOING', 'COMPLETED', 'ARCHIVED');
ALTER TABLE "Competition" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Competition" ALTER COLUMN "status" TYPE "CompetitionStatus_new"
  USING (CASE WHEN "status"::text = 'ACTIVE' THEN 'ONGOING' ELSE "status"::text END)::"CompetitionStatus_new";
ALTER TYPE "CompetitionStatus" RENAME TO "CompetitionStatus_old";
ALTER TYPE "CompetitionStatus_new" RENAME TO "CompetitionStatus";
DROP TYPE "CompetitionStatus_old";
ALTER TABLE "Competition" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

DROP INDEX "Venue_organizationId_idx";

ALTER TABLE "Organization"
  ADD COLUMN "address" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Competition"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "regulations" TEXT;

ALTER TABLE "Season"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "drawPoints" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lossPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "regulations" TEXT,
  ADD COLUMN "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "tieBreakers" JSONB NOT NULL DEFAULT '["points","goal_difference","goals_for"]',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "winPoints" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "Season" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Venue"
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "photoUrl" TEXT,
  ADD COLUMN "status" "VenueStatus" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "surfaceType" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Venue" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Club"
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "homeVenueId" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CompetitionClub" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "competitionId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "clubId" TEXT NOT NULL,
  "status" "ParticipationStatus" NOT NULL DEFAULT 'PENDING',
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitionClub_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Official" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "photoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Official_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfficialAssignment" (
  "id" TEXT NOT NULL,
  "officialId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "clubId" TEXT,
  "role" "OfficialRole" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "OfficialAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitionClub_organizationId_competitionId_status_idx" ON "CompetitionClub"("organizationId", "competitionId", "status");
CREATE INDEX "CompetitionClub_clubId_idx" ON "CompetitionClub"("clubId");
CREATE UNIQUE INDEX "CompetitionClub_seasonId_clubId_key" ON "CompetitionClub"("seasonId", "clubId");
CREATE INDEX "Official_organizationId_isActive_deletedAt_idx" ON "Official"("organizationId", "isActive", "deletedAt");
CREATE UNIQUE INDEX "Official_organizationId_email_key" ON "Official"("organizationId", "email");
CREATE INDEX "OfficialAssignment_seasonId_role_idx" ON "OfficialAssignment"("seasonId", "role");
CREATE INDEX "OfficialAssignment_officialId_startsAt_idx" ON "OfficialAssignment"("officialId", "startsAt");
CREATE UNIQUE INDEX "OfficialAssignment_officialId_seasonId_role_clubId_key" ON "OfficialAssignment"("officialId", "seasonId", "role", "clubId");
CREATE INDEX "Club_homeVenueId_idx" ON "Club"("homeVenueId");
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
CREATE INDEX "Venue_organizationId_status_deletedAt_idx" ON "Venue"("organizationId", "status", "deletedAt");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Club" ADD CONSTRAINT "Club_homeVenueId_fkey" FOREIGN KEY ("homeVenueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetitionClub" ADD CONSTRAINT "CompetitionClub_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionClub" ADD CONSTRAINT "CompetitionClub_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionClub" ADD CONSTRAINT "CompetitionClub_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionClub" ADD CONSTRAINT "CompetitionClub_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Official" ADD CONSTRAINT "Official_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficialAssignment" ADD CONSTRAINT "OfficialAssignment_officialId_fkey" FOREIGN KEY ("officialId") REFERENCES "Official"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficialAssignment" ADD CONSTRAINT "OfficialAssignment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficialAssignment" ADD CONSTRAINT "OfficialAssignment_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
