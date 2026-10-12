CREATE TABLE "PublicationConsent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "scope" TEXT NOT NULL DEFAULT 'PUBLIC_PROFILE',
  "legalBasis" TEXT NOT NULL,
  "isMinor" BOOLEAN NOT NULL,
  "guardianConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "evidenceHash" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "withdrawalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicationConsent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublicationConsent_organizationId_playerId_scope_withdrawnAt_expiresAt_idx" ON "PublicationConsent"("organizationId", "playerId", "scope", "withdrawnAt", "expiresAt");
ALTER TABLE "PublicationConsent" ADD CONSTRAINT "PublicationConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationConsent" ADD CONSTRAINT "PublicationConsent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationConsent" ADD CONSTRAINT "PublicationConsent_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicationConsent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON "PublicationConsent" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
