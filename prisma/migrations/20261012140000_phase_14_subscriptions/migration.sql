-- Phase 14: provider-neutral subscription, entitlements, and atomic usage ledger.
-- No payment provider, checkout, invoice, or real billing side effect is enabled.

CREATE TYPE "PlanBillingModel" AS ENUM ('ZERO', 'RECURRING', 'EVENT', 'CONTRACT');
CREATE TYPE "EntitlementValueType" AS ENUM ('BOOLEAN', 'INTEGER', 'STRING');
CREATE TYPE "EntitlementScope" AS ENUM ('ORGANIZATION', 'COMPETITION', 'SEASON');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'SUSPENDED', 'CANCELED', 'EXPIRED');
CREATE TYPE "UsageEventKind" AS ENUM ('RESERVE', 'COMMIT', 'RELEASE', 'RECONCILE');

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlanVersion" (
  "id" TEXT NOT NULL, "planId" TEXT NOT NULL, "version" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL, "description" TEXT NOT NULL, "billingModel" "PlanBillingModel" NOT NULL,
  "currency" TEXT NOT NULL, "priceConfig" JSONB NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlanFeature" (
  "id" TEXT NOT NULL, "planVersionId" TEXT NOT NULL, "featureKey" TEXT NOT NULL,
  "valueType" "EntitlementValueType" NOT NULL, "scope" "EntitlementScope" NOT NULL DEFAULT 'ORGANIZATION',
  "enabled" BOOLEAN NOT NULL DEFAULT false, "limit" INTEGER, "value" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrganizationSubscription" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "planVersionId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE', "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialEndsAt" TIMESTAMP(3), "currentPeriodStart" TIMESTAMP(3), "currentPeriodEnd" TIMESTAMP(3),
  "graceEndsAt" TIMESTAMP(3), "canceledAt" TIMESTAMP(3), "suspendedAt" TIMESTAMP(3),
  "assignedById" TEXT, "reason" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CompetitionEntitlement" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "competitionId" TEXT NOT NULL,
  "seasonId" TEXT, "planVersionId" TEXT NOT NULL, "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL, "assignedById" TEXT,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetitionEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageCounter" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "metricKey" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL DEFAULT 'organization', "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0, "reserved" INTEGER NOT NULL DEFAULT 0, "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "counterId" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL, "scopeKey" TEXT NOT NULL DEFAULT 'organization', "eventKey" TEXT NOT NULL,
  "kind" "UsageEventKind" NOT NULL, "delta" INTEGER NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SubscriptionAudit" (
  "id" TEXT NOT NULL, "organizationId" TEXT NOT NULL, "subscriptionId" TEXT NOT NULL, "actorId" TEXT,
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL, "before" JSONB, "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "SubscriptionAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");
CREATE INDEX "PlanVersion_isActive_effectiveFrom_effectiveTo_idx" ON "PlanVersion"("isActive", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");
CREATE INDEX "PlanFeature_featureKey_enabled_idx" ON "PlanFeature"("featureKey", "enabled");
CREATE UNIQUE INDEX "PlanFeature_planVersionId_featureKey_scope_key" ON "PlanFeature"("planVersionId", "featureKey", "scope");
CREATE UNIQUE INDEX "OrganizationSubscription_organizationId_key" ON "OrganizationSubscription"("organizationId");
CREATE INDEX "OrganizationSubscription_status_currentPeriodEnd_graceEndsA_idx" ON "OrganizationSubscription"("status", "currentPeriodEnd", "graceEndsAt");
CREATE INDEX "CompetitionEntitlement_organizationId_competitionId_seasonI_idx" ON "CompetitionEntitlement"("organizationId", "competitionId", "seasonId", "status", "endsAt");
CREATE INDEX "UsageCounter_organizationId_periodEnd_idx" ON "UsageCounter"("organizationId", "periodEnd");
CREATE UNIQUE INDEX "UsageCounter_organizationId_metricKey_scopeKey_periodStart_key" ON "UsageCounter"("organizationId", "metricKey", "scopeKey", "periodStart");
CREATE INDEX "UsageEvent_organizationId_metricKey_createdAt_idx" ON "UsageEvent"("organizationId", "metricKey", "createdAt");
CREATE UNIQUE INDEX "UsageEvent_organizationId_metricKey_eventKey_kind_key" ON "UsageEvent"("organizationId", "metricKey", "eventKey", "kind");
CREATE INDEX "SubscriptionAudit_organizationId_createdAt_idx" ON "SubscriptionAudit"("organizationId", "createdAt");
CREATE INDEX "SubscriptionAudit_subscriptionId_createdAt_idx" ON "SubscriptionAudit"("subscriptionId", "createdAt");

ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntitlement" ADD CONSTRAINT "CompetitionEntitlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntitlement" ADD CONSTRAINT "CompetitionEntitlement_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntitlement" ADD CONSTRAINT "CompetitionEntitlement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntitlement" ADD CONSTRAINT "CompetitionEntitlement_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetitionEntitlement" ADD CONSTRAINT "CompetitionEntitlement_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_counterId_fkey" FOREIGN KEY ("counterId") REFERENCES "UsageCounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAudit" ADD CONSTRAINT "SubscriptionAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAudit" ADD CONSTRAINT "SubscriptionAudit_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionAudit" ADD CONSTRAINT "SubscriptionAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Immutable v1 catalog. Price and quota values are data, never UI constants.
INSERT INTO "Plan" (id, code, "isActive", "createdAt", "updatedAt") VALUES
  ('plan_free', 'FREE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_tournament', 'TOURNAMENT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_pro_league', 'PRO_LEAGUE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_organizer_pro', 'ORGANIZER_PRO', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_enterprise', 'ENTERPRISE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO "PlanVersion" (id, "planId", version, "displayName", description, "billingModel", currency, "priceConfig", "isActive", "effectiveFrom") VALUES
  ('pv_free_v1', 'plan_free', 1, 'Free', 'Fondasi untuk satu kompetisi kecil.', 'ZERO', 'IDR', '{"amountMinor":0,"interval":"none","taxMode":"exclusive"}', true, '2026-10-12'),
  ('pv_tournament_v1', 'plan_tournament', 1, 'Tournament', 'Akses satu event hingga 120 hari.', 'EVENT', 'IDR', '{"amountMinor":75000000,"unit":"competition","accessDays":120,"taxMode":"exclusive"}', true, '2026-10-12'),
  ('pv_pro_league_v1', 'plan_pro_league', 1, 'Pro League', 'Operasional liga profesional.', 'RECURRING', 'IDR', '{"amountMinor":150000000,"interval":"month","taxMode":"exclusive"}', true, '2026-10-12'),
  ('pv_organizer_pro_v1', 'plan_organizer_pro', 1, 'Organizer Pro', 'Multi-kompetisi untuk organizer profesional.', 'RECURRING', 'IDR', '{"amountMinor":350000000,"interval":"month","taxMode":"exclusive"}', true, '2026-10-12'),
  ('pv_enterprise_v1', 'plan_enterprise', 1, 'Enterprise', 'Paket kontrak dengan konfigurasi khusus.', 'CONTRACT', 'IDR', '{"amountMinor":null,"interval":"contract","taxMode":"configured"}', true, '2026-10-12');

-- Common stable feature registry encoded per immutable plan version.
INSERT INTO "PlanFeature" (id, "planVersionId", "featureKey", "valueType", scope, enabled, "limit", value) VALUES
  ('pf_free_create', 'pv_free_v1', 'competition.create', 'BOOLEAN', 'ORGANIZATION', true, NULL, 'true'),
  ('pf_free_comp', 'pv_free_v1', 'competition.max_active', 'INTEGER', 'ORGANIZATION', true, 1, NULL),
  ('pf_free_club', 'pv_free_v1', 'club.max_per_competition', 'INTEGER', 'COMPETITION', true, 8, NULL),
  ('pf_free_player', 'pv_free_v1', 'player.max_per_competition', 'INTEGER', 'COMPETITION', true, 150, NULL),
  ('pf_free_staff', 'pv_free_v1', 'member.max_active', 'INTEGER', 'ORGANIZATION', true, 3, NULL),
  ('pf_free_live', 'pv_free_v1', 'match.live', 'BOOLEAN', 'ORGANIZATION', true, 1, NULL),
  ('pf_free_stats', 'pv_free_v1', 'statistics.advanced', 'BOOLEAN', 'ORGANIZATION', false, NULL, NULL),
  ('pf_free_pdf', 'pv_free_v1', 'export.pdf', 'BOOLEAN', 'ORGANIZATION', true, 3, NULL),
  ('pf_free_excel', 'pv_free_v1', 'export.excel', 'BOOLEAN', 'ORGANIZATION', true, 3, NULL),
  ('pf_free_news', 'pv_free_v1', 'content.news', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_free_brand', 'pv_free_v1', 'branding.organizer', 'BOOLEAN', 'ORGANIZATION', false, NULL, NULL),
  ('pf_free_seasons', 'pv_free_v1', 'season.multiple', 'BOOLEAN', 'ORGANIZATION', false, 1, NULL),
  ('pf_free_support', 'pv_free_v1', 'support.priority', 'BOOLEAN', 'ORGANIZATION', false, NULL, '"community"'),
  ('pf_t_create', 'pv_tournament_v1', 'competition.create', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_t_comp', 'pv_tournament_v1', 'competition.max_active', 'INTEGER', 'ORGANIZATION', true, 1, NULL),
  ('pf_t_club', 'pv_tournament_v1', 'club.max_per_competition', 'INTEGER', 'COMPETITION', true, 32, NULL),
  ('pf_t_player', 'pv_tournament_v1', 'player.max_per_competition', 'INTEGER', 'COMPETITION', true, 1000, NULL),
  ('pf_t_staff', 'pv_tournament_v1', 'member.max_active', 'INTEGER', 'ORGANIZATION', true, 10, NULL),
  ('pf_t_live', 'pv_tournament_v1', 'match.live', 'BOOLEAN', 'ORGANIZATION', true, 4, NULL),
  ('pf_t_stats', 'pv_tournament_v1', 'statistics.advanced', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_t_pdf', 'pv_tournament_v1', 'export.pdf', 'BOOLEAN', 'ORGANIZATION', true, 50, NULL),
  ('pf_t_excel', 'pv_tournament_v1', 'export.excel', 'BOOLEAN', 'ORGANIZATION', true, 50, NULL),
  ('pf_t_news', 'pv_tournament_v1', 'content.news', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_t_brand', 'pv_tournament_v1', 'branding.organizer', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"event"'),
  ('pf_t_seasons', 'pv_tournament_v1', 'season.multiple', 'BOOLEAN', 'ORGANIZATION', false, 1, NULL),
  ('pf_t_support', 'pv_tournament_v1', 'support.priority', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"event"'),
  ('pf_l_create', 'pv_pro_league_v1', 'competition.create', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_l_comp', 'pv_pro_league_v1', 'competition.max_active', 'INTEGER', 'ORGANIZATION', true, 1, NULL),
  ('pf_l_club', 'pv_pro_league_v1', 'club.max_per_competition', 'INTEGER', 'COMPETITION', true, 40, NULL),
  ('pf_l_player', 'pv_pro_league_v1', 'player.max_per_competition', 'INTEGER', 'COMPETITION', true, 2000, NULL),
  ('pf_l_staff', 'pv_pro_league_v1', 'member.max_active', 'INTEGER', 'ORGANIZATION', true, 20, NULL),
  ('pf_l_live', 'pv_pro_league_v1', 'match.live', 'BOOLEAN', 'ORGANIZATION', true, 8, NULL),
  ('pf_l_stats', 'pv_pro_league_v1', 'statistics.advanced', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_l_pdf', 'pv_pro_league_v1', 'export.pdf', 'BOOLEAN', 'ORGANIZATION', true, 100, NULL),
  ('pf_l_excel', 'pv_pro_league_v1', 'export.excel', 'BOOLEAN', 'ORGANIZATION', true, 100, NULL),
  ('pf_l_news', 'pv_pro_league_v1', 'content.news', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_l_brand', 'pv_pro_league_v1', 'branding.organizer', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"basic"'),
  ('pf_l_seasons', 'pv_pro_league_v1', 'season.multiple', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_l_support', 'pv_pro_league_v1', 'support.priority', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"business"'),
  ('pf_o_create', 'pv_organizer_pro_v1', 'competition.create', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_o_comp', 'pv_organizer_pro_v1', 'competition.max_active', 'INTEGER', 'ORGANIZATION', true, 10, NULL),
  ('pf_o_club', 'pv_organizer_pro_v1', 'club.max_per_competition', 'INTEGER', 'COMPETITION', true, 64, NULL),
  ('pf_o_player', 'pv_organizer_pro_v1', 'player.max_per_competition', 'INTEGER', 'COMPETITION', true, 5000, NULL),
  ('pf_o_staff', 'pv_organizer_pro_v1', 'member.max_active', 'INTEGER', 'ORGANIZATION', true, 100, NULL),
  ('pf_o_live', 'pv_organizer_pro_v1', 'match.live', 'BOOLEAN', 'ORGANIZATION', true, 20, NULL),
  ('pf_o_stats', 'pv_organizer_pro_v1', 'statistics.advanced', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_o_pdf', 'pv_organizer_pro_v1', 'export.pdf', 'BOOLEAN', 'ORGANIZATION', true, 500, NULL),
  ('pf_o_excel', 'pv_organizer_pro_v1', 'export.excel', 'BOOLEAN', 'ORGANIZATION', true, 500, NULL),
  ('pf_o_news', 'pv_organizer_pro_v1', 'content.news', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_o_brand', 'pv_organizer_pro_v1', 'branding.organizer', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"advanced"'),
  ('pf_o_seasons', 'pv_organizer_pro_v1', 'season.multiple', 'BOOLEAN', 'ORGANIZATION', true, NULL, NULL),
  ('pf_o_support', 'pv_organizer_pro_v1', 'support.priority', 'BOOLEAN', 'ORGANIZATION', true, NULL, '"priority"');

INSERT INTO "PlanFeature" (id, "planVersionId", "featureKey", "valueType", scope, enabled, "limit", value)
SELECT 'pf_e_' || row_number() OVER (), 'pv_enterprise_v1', "featureKey", "valueType", scope, true, NULL,
       CASE WHEN "featureKey" = 'branding.organizer' THEN '"custom"'::jsonb WHEN "featureKey" = 'support.priority' THEN '"contract"'::jsonb ELSE value END
FROM "PlanFeature" WHERE "planVersionId" = 'pv_organizer_pro_v1';

-- Existing organizations retain all Phase 0-13 capabilities. Commercial
-- migration is an explicit owner decision, never a silent downgrade.
INSERT INTO "OrganizationSubscription" (id, "organizationId", "planVersionId", status, "startsAt", reason, "createdAt", "updatedAt")
SELECT 'sub_' || id, id, 'pv_enterprise_v1', 'ACTIVE', CURRENT_TIMESTAMP, 'PHASE_14_LEGACY_COMPATIBILITY_BACKFILL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organization" ON CONFLICT ("organizationId") DO NOTHING;

INSERT INTO "Permission" (id, key, description) VALUES
  ('phase14_billing_view', 'organization.billing.view', 'Melihat paket dan status subscription organisasi'),
  ('phase14_usage_view', 'organization.plan_usage.view', 'Melihat entitlement dan penggunaan kuota organisasi')
ON CONFLICT (key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role.id, permission.id FROM "Role" role CROSS JOIN "Permission" permission
WHERE role.key IN ('organization-owner', 'e2e-owner') AND permission.key IN ('organization.billing.view', 'organization.plan_usage.view')
ON CONFLICT DO NOTHING;

-- Catalog is globally readable only for published active versions; runtime writes are denied.
ALTER TABLE "Plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlanFeature" ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_plan_read ON "Plan" FOR SELECT USING ("isActive" = true OR current_setting('app.platform_admin', true) = 'true');
CREATE POLICY catalog_version_read ON "PlanVersion" FOR SELECT USING (("isActive" = true AND "effectiveFrom" <= CURRENT_TIMESTAMP AND ("effectiveTo" IS NULL OR "effectiveTo" > CURRENT_TIMESTAMP)) OR current_setting('app.platform_admin', true) = 'true');
CREATE POLICY catalog_feature_read ON "PlanFeature" FOR SELECT USING (EXISTS (SELECT 1 FROM "PlanVersion" version WHERE version.id = "PlanFeature"."planVersionId" AND version."isActive" = true) OR current_setting('app.platform_admin', true) = 'true');

-- Tenant commercial state remains under the existing organization boundary.
ALTER TABLE "OrganizationSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetitionEntitlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageCounter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionAudit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_default_deny ON "OrganizationSubscription" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY tenant_default_deny ON "CompetitionEntitlement" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY tenant_default_deny ON "UsageCounter" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY tenant_default_deny ON "UsageEvent" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY tenant_default_deny ON "SubscriptionAudit" FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"));
CREATE POLICY provisioning_free_subscription ON "OrganizationSubscription" FOR ALL
  USING (current_setting('app.access_mode', true) = 'provisioning' AND public.app_organization_owned("organizationId", NULLIF(current_setting('app.current_user_id', true), '')))
  WITH CHECK (current_setting('app.access_mode', true) = 'provisioning' AND "planVersionId" = 'pv_free_v1' AND status = 'ACTIVE' AND public.app_organization_owned("organizationId", NULLIF(current_setting('app.current_user_id', true), '')));
