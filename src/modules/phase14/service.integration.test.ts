import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, rootDb } from "@/lib/db";
import { withTenantDatabase } from "@/lib/tenant-db";
import { createResource } from "@/modules/phase1/service";
import { assignPlan, billingSnapshot, evaluateEntitlement, listPlanCatalog, reconcileCounter, transitionSubscription } from "./service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const setup = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : db;
const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);
let organizationA = ""; let organizationB = ""; let ownerA = ""; let ownerB = ""; let platformId = "";
const tenantActor = () => ({ id: ownerA, isActive: true, isPlatformAdmin: false, deletedAt: null });
const platformActor = () => ({ id: platformId, isActive: true, isPlatformAdmin: true, deletedAt: null });

describe.sequential("Phase 14 subscriptions, entitlements, and quotas", () => {
  beforeAll(async () => {
    const [userA, userB, platform] = await Promise.all([
      setup.user.create({ data: { email: `phase14-a-${suffix}@test.invalid`, name: "Phase 14 A", passwordHash: "test", isActive: true, emailVerifiedAt: new Date() } }),
      setup.user.create({ data: { email: `phase14-b-${suffix}@test.invalid`, name: "Phase 14 B", passwordHash: "test", isActive: true, emailVerifiedAt: new Date() } }),
      setup.user.create({ data: { email: `phase14-platform-${suffix}@test.invalid`, name: "Phase 14 Platform", passwordHash: "test", isActive: true, emailVerifiedAt: new Date(), isPlatformAdmin: true } }),
    ]); ownerA = userA.id; ownerB = userB.id; platformId = platform.id;
    const [orgA, orgB] = await Promise.all([
      setup.organization.create({ data: { name: "Phase 14 Tenant A", slug: `phase14-a-${suffix}`, status: "ACTIVE", ownerId: ownerA } }),
      setup.organization.create({ data: { name: "Phase 14 Tenant B", slug: `phase14-b-${suffix}`, status: "ACTIVE", ownerId: ownerB } }),
    ]); organizationA = orgA.id; organizationB = orgB.id;
    const permissions = await Promise.all(["organization.view", "organization.billing.view", "organization.plan_usage.view", "competition.create", "competition.view"].map((key) => setup.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    for (const [organizationId, userId] of [[organizationA, ownerA], [organizationB, ownerB]]) {
      const role = await setup.role.create({ data: { organizationId, name: "Owner", key: "organization-owner", permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
      await setup.organizationMember.create({ data: { organizationId, userId, roleId: role.id } });
      await setup.organizationSubscription.create({ data: { organizationId, planVersionId: "pv_free_v1", status: "ACTIVE", reason: "PHASE_14_TEST_FREE" } });
    }
  });

  afterAll(async () => {
    const organizations = [organizationA, organizationB].filter(Boolean); const users = [ownerA, ownerB, platformId].filter(Boolean);
    await setup.subscriptionAudit.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.auditLog.deleteMany({ where: { OR: [{ organizationId: { in: organizations } }, { actorId: { in: users } }] } });
    await setup.usageEvent.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.usageCounter.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.competitionEntitlement.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.organizationSubscription.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.competition.deleteMany({ where: { organizationId: { in: organizations } } });
    await setup.organization.deleteMany({ where: { id: { in: organizations } } });
    await setup.user.deleteMany({ where: { id: { in: users } } });
    await runtime?.$disconnect(); await setup.$disconnect(); if (setup !== db) await db.$disconnect();
  });

  it("publishes exactly five versioned plans from server-side configuration", async () => {
    const catalog = await listPlanCatalog();
    expect(catalog.map((plan) => plan.code).sort()).toEqual(["ENTERPRISE", "FREE", "ORGANIZER_PRO", "PRO_LEAGUE", "TOURNAMENT"]);
    expect(catalog.every((plan) => plan.versions[0]?.features.length)).toBe(true);
  });

  it("requires both tenant permission and entitlement", async () => {
    const decision = await withTenantDatabase(rootDb, organizationA, () => evaluateEntitlement(organizationA, "competition.create"));
    expect(decision).toMatchObject({ allowed: true, planCode: "FREE" });
    await expect(billingSnapshot(tenantActor(), organizationB)).rejects.toMatchObject({ status: 403 });
  });

  it("serializes concurrent quota consumption and blocks idempotency replay", async () => {
    const results = await Promise.allSettled(["quota-request-a", "quota-request-b"].map((key, index) => withTenantDatabase(rootDb, organizationA, () => createResource("competitions", tenantActor(), organizationA, { name: `Quota ${index}`, slug: `quota-${suffix}-${index}`, format: "SINGLE_ROUND_ROBIN", status: "DRAFT" }, key))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const acceptedKey = results[0].status === "fulfilled" ? "quota-request-a" : "quota-request-b";
    await expect(withTenantDatabase(rootDb, organizationA, () => createResource("competitions", tenantActor(), organizationA, { name: "Replay", slug: `replay-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "DRAFT" }, acceptedKey))).rejects.toMatchObject({ status: 409 });
    expect(await setup.competition.count({ where: { organizationId: organizationA } })).toBe(1);
  });

  it("preserves data on downgrade and makes expired subscriptions read-only", async () => {
    await assignPlan(platformActor(), { organizationId: organizationA, planCode: "ENTERPRISE", version: 1, status: "ACTIVE", reason: "Test upgrade without payment" });
    await withTenantDatabase(rootDb, organizationA, () => createResource("competitions", tenantActor(), organizationA, { name: "Preserved", slug: `preserved-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "DRAFT" }, "enterprise-create-request"));
    await assignPlan(platformActor(), { organizationId: organizationA, planCode: "FREE", version: 1, status: "ACTIVE", reason: "Test safe downgrade policy" });
    expect(await setup.competition.count({ where: { organizationId: organizationA } })).toBe(2);
    await setup.organizationSubscription.update({ where: { organizationId: organizationA }, data: { status: "EXPIRED" } });
    const [write, read] = await withTenantDatabase(rootDb, organizationA, () => Promise.all([evaluateEntitlement(organizationA, "competition.create", { operation: "WRITE" }), evaluateEntitlement(organizationA, "competition.create", { operation: "READ" })]));
    expect(write.allowed).toBe(false); expect(read.allowed).toBe(true);
    expect(await setup.competition.count({ where: { organizationId: organizationA } })).toBe(2);
  });

  it("audits trial extension, suspension, reactivation, and usage reconciliation", async () => {
    await assignPlan(platformActor(), { organizationId: organizationB, planCode: "ORGANIZER_PRO", version: 1, status: "TRIAL", trialDays: 7, reason: "Controlled organizer trial assignment" });
    const extended = await transitionSubscription(platformActor(), { organizationId: organizationB, action: "EXTEND_TRIAL", days: 7, reason: "Approved trial extension for pilot" });
    expect(extended.status).toBe("TRIAL");
    expect(extended.trialEndsAt!.valueOf()).toBeGreaterThan(Date.now() + 13 * 86_400_000);
    expect((await transitionSubscription(platformActor(), { organizationId: organizationB, action: "SUSPEND", reason: "Manual suspension security review" })).status).toBe("SUSPENDED");
    expect((await transitionSubscription(platformActor(), { organizationId: organizationB, action: "REACTIVATE", reason: "Security review completed safely" })).status).toBe("ACTIVE");
    const counter = await reconcileCounter(platformActor(), organizationA, "competition.active", "organization", "Scheduled authoritative usage reconciliation");
    expect(counter).toMatchObject({ used: 2, reserved: 0 });
    expect(await setup.subscriptionAudit.count({ where: { organizationId: organizationB } })).toBeGreaterThanOrEqual(4);
    expect(await setup.usageEvent.count({ where: { organizationId: organizationA, kind: "RECONCILE" } })).toBe(1);
  });

  it("resolves a time-bounded competition entitlement without changing the organization plan", async () => {
    const competition = await setup.competition.findFirstOrThrow({ where: { organizationId: organizationA } });
    const tournament = await setup.planVersion.findUniqueOrThrow({ where: { planId_version: { planId: "plan_tournament", version: 1 } } });
    await withTenantDatabase(rootDb, organizationA, () => db.competitionEntitlement.create({ data: { organizationId: organizationA, competitionId: competition.id, planVersionId: tournament.id, status: "ACTIVE", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000), reason: "Scoped tournament purchase simulation" } }));
    const decision = await withTenantDatabase(rootDb, organizationA, () => evaluateEntitlement(organizationA, "club.max_per_competition", { competitionId: competition.id }));
    expect(decision).toMatchObject({ allowed: true, planCode: "TOURNAMENT", source: "COMPETITION", limit: 32 });
  });

  it("rejects unauthorized assignment and client plan tampering", async () => {
    await expect(assignPlan(tenantActor(), { organizationId: organizationA, planCode: "ENTERPRISE", version: 1, status: "ACTIVE", reason: "Unauthorized plan change" })).rejects.toMatchObject({ status: 403 });
    await expect(assignPlan(platformActor(), { organizationId: organizationA, planCode: "FAKE_PLAN", version: 1, status: "ACTIVE", reason: "Tampered plan identifier" })).rejects.toBeTruthy();
  });

  it.skipIf(!runtime)("default-denies tenant billing state while allowing active catalog reads", async () => {
    expect(await runtime!.organizationSubscription.count()).toBe(0);
    expect(await runtime!.usageCounter.count()).toBe(0);
    expect(await runtime!.plan.count()).toBe(5);
    expect(await withTenantDatabase(runtime!, organizationA, () => db.organizationSubscription.count())).toBe(1);
    expect(await withTenantDatabase(runtime!, organizationB, () => db.organizationSubscription.count())).toBe(1);
    await expect(runtime!.plan.update({ where: { id: "plan_free" }, data: { isActive: false } })).rejects.toBeTruthy();
  });
});
