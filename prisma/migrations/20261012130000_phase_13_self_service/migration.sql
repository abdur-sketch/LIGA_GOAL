-- Phase 13: self-service identity verification, organizer provisioning, and
-- staff invitations. All changes are additive; existing active identities are
-- treated as verified to preserve Phase 0-11 authentication behavior.

CREATE TYPE "OrganizerType" AS ENUM ('COMMUNITY', 'CLUB_ASSOCIATION', 'SCHOOL', 'CORPORATE', 'GOVERNMENT', 'FEDERATION', 'OTHER');
CREATE TYPE "OrganizerOnboardingStatus" AS ENUM ('DRAFT', 'COMPLETED');
CREATE TYPE "OrganizationInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User"
SET "emailVerifiedAt" = COALESCE("lastLoginAt", "createdAt")
WHERE "isActive" = true AND "deletedAt" IS NULL;

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "resendAllowedAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizerOnboarding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "organizerType" "OrganizerType" NOT NULL,
  "region" TEXT NOT NULL,
  "status" "OrganizerOnboardingStatus" NOT NULL DEFAULT 'COMPLETED',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizerOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationConsentRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requestId" TEXT,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "source" TEXT NOT NULL DEFAULT 'ORGANIZER_ONBOARDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationInvitation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "acceptedById" TEXT,
  "tokenHash" TEXT NOT NULL,
  "status" "OrganizationInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_usedAt_idx" ON "EmailVerificationToken"("userId", "expiresAt", "usedAt");
CREATE UNIQUE INDEX "OrganizerOnboarding_organizationId_key" ON "OrganizerOnboarding"("organizationId");
CREATE UNIQUE INDEX "OrganizerOnboarding_userId_key" ON "OrganizerOnboarding"("userId");
CREATE UNIQUE INDEX "OrganizerOnboarding_idempotencyKey_key" ON "OrganizerOnboarding"("idempotencyKey");
CREATE INDEX "OrganizerOnboarding_userId_status_idx" ON "OrganizerOnboarding"("userId", "status");
CREATE INDEX "OrganizationConsentRecord_organizationId_acceptedAt_idx" ON "OrganizationConsentRecord"("organizationId", "acceptedAt");
CREATE UNIQUE INDEX "OrganizationConsentRecord_organizationId_userId_termsVersio_key" ON "OrganizationConsentRecord"("organizationId", "userId", "termsVersion", "privacyVersion");
CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key" ON "OrganizationInvitation"("tokenHash");
CREATE INDEX "OrganizationInvitation_organizationId_status_createdAt_idx" ON "OrganizationInvitation"("organizationId", "status", "createdAt");
CREATE INDEX "OrganizationInvitation_email_status_expiresAt_idx" ON "OrganizationInvitation"("email", "status", "expiresAt");

ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizerOnboarding" ADD CONSTRAINT "OrganizerOnboarding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizerOnboarding" ADD CONSTRAINT "OrganizerOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationConsentRecord" ADD CONSTRAINT "OrganizationConsentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationConsentRecord" ADD CONSTRAINT "OrganizationConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "key", "description")
VALUES ('phase13_org_invitation_manage', 'organization.invitation.manage', 'Mengelola undangan staf organisasi')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role.id, permission.id
FROM "Role" role
JOIN "Permission" permission ON permission.key = 'organization.invitation.manage'
WHERE role.key = 'organization-owner'
ON CONFLICT DO NOTHING;

ALTER TABLE "OrganizerOnboarding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON "OrganizerOnboarding" FOR ALL
  USING (public.app_tenant_allowed("organizationId"))
  WITH CHECK (public.app_tenant_allowed("organizationId"));
ALTER TABLE "OrganizationConsentRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON "OrganizationConsentRecord" FOR ALL
  USING (public.app_tenant_allowed("organizationId"))
  WITH CHECK (public.app_tenant_allowed("organizationId"));
ALTER TABLE "OrganizationInvitation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON "OrganizationInvitation" FOR ALL
  USING (public.app_tenant_allowed("organizationId"))
  WITH CHECK (public.app_tenant_allowed("organizationId"));

-- The ownership predicate runs as the migration owner so policies can verify
-- a single owner relationship without recursively evaluating Organization RLS.
CREATE FUNCTION public.app_organization_owned(organization_id text, user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public."Organization"
    WHERE id = organization_id AND "ownerId" = user_id AND "deletedAt" IS NULL
  )
$$;

-- Provisioning has no platform bypass. It can only create/read the organization
-- owned by the verified identity in app.current_user_id and its bootstrap rows.
CREATE POLICY provisioning_organization ON "Organization" FOR ALL
  USING (
    current_setting('app.access_mode', true) = 'provisioning'
    AND "ownerId" = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'provisioning'
    AND "ownerId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "status" = 'ACTIVE'
    AND "deletedAt" IS NULL
  );

CREATE POLICY provisioning_role ON "Role" FOR ALL
  USING (
    current_setting('app.access_mode', true) = 'provisioning'
    AND EXISTS (SELECT 1 FROM "Organization" organization WHERE organization.id = "Role"."organizationId" AND organization."ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'provisioning'
    AND EXISTS (SELECT 1 FROM "Organization" organization WHERE organization.id = "Role"."organizationId" AND organization."ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  );

CREATE POLICY provisioning_role_permission ON "RolePermission" FOR ALL
  USING (
    current_setting('app.access_mode', true) = 'provisioning'
    AND EXISTS (SELECT 1 FROM "Role" role JOIN "Organization" organization ON organization.id = role."organizationId" WHERE role.id = "RolePermission"."roleId" AND organization."ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'provisioning'
    AND EXISTS (SELECT 1 FROM "Role" role JOIN "Organization" organization ON organization.id = role."organizationId" WHERE role.id = "RolePermission"."roleId" AND organization."ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  );

CREATE POLICY provisioning_membership ON "OrganizationMember" FOR ALL
  USING (
    current_setting('app.access_mode', true) = 'provisioning'
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND public.app_organization_owned("organizationId", "userId")
  )
  WITH CHECK (
    current_setting('app.access_mode', true) = 'provisioning'
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND public.app_organization_owned("organizationId", "userId")
  );

CREATE POLICY provisioning_onboarding ON "OrganizerOnboarding" FOR ALL
  USING (current_setting('app.access_mode', true) = 'provisioning' AND "userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK (current_setting('app.access_mode', true) = 'provisioning' AND "userId" = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE POLICY provisioning_consent ON "OrganizationConsentRecord" FOR ALL
  USING (current_setting('app.access_mode', true) = 'provisioning' AND "userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK (current_setting('app.access_mode', true) = 'provisioning' AND "userId" = NULLIF(current_setting('app.current_user_id', true), ''));

CREATE POLICY provisioning_audit_insert ON "AuditLog" FOR INSERT
  WITH CHECK (
    current_setting('app.access_mode', true) = 'provisioning'
    AND "actorId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND EXISTS (SELECT 1 FROM "Organization" organization WHERE organization.id = "AuditLog"."organizationId" AND organization."ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  );

-- A token lookup is restricted to the authenticated identity's normalized
-- email and an exact server-side token digest. Mutations still require a
-- normal tenant transaction after this discovery step.
CREATE POLICY invitation_exact_discovery ON "OrganizationInvitation" FOR SELECT
  USING (
    current_setting('app.access_mode', true) = 'invitation'
    AND "tokenHash" = NULLIF(current_setting('app.current_invitation_token_hash', true), '')
    AND "status" = 'PENDING'
    AND "expiresAt" > CURRENT_TIMESTAMP
    AND lower("email") = lower((SELECT "email" FROM "User" WHERE id = NULLIF(current_setting('app.current_user_id', true), '')))
  );
