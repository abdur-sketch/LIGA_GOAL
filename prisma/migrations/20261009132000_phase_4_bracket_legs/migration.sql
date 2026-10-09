CREATE TABLE "BracketLeg" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tieId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "leg" INTEGER NOT NULL,
  CONSTRAINT "BracketLeg_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BracketLeg_matchId_key" ON "BracketLeg"("matchId");
CREATE UNIQUE INDEX "BracketLeg_tieId_leg_key" ON "BracketLeg"("tieId", "leg");
CREATE INDEX "BracketLeg_organizationId_tieId_idx" ON "BracketLeg"("organizationId", "tieId");

ALTER TABLE "BracketLeg" ADD CONSTRAINT "BracketLeg_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BracketLeg" ADD CONSTRAINT "BracketLeg_tieId_fkey"
FOREIGN KEY ("tieId") REFERENCES "BracketTie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BracketLeg" ADD CONSTRAINT "BracketLeg_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
