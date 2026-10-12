import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { withTenantDatabase } from "@/lib/tenant-db";
import { mockPaymentProvider } from "./provider";
import { approveRefund, createCheckout, invoiceDetail, processMockWebhook, reconcileInvoice, requestRefund, simulatePayment } from "./service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const setup = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : db;
const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const suffix = crypto.randomUUID().slice(0, 8);
let orgA = "", orgB = "", userA = "", userB = "", financeId = "";
const actorA = () => ({ id: userA, isActive: true, isPlatformAdmin: false, deletedAt: null });
const actorB = () => ({ id: userB, isActive: true, isPlatformAdmin: false, deletedAt: null });
const finance = () => ({ id: financeId, isActive: true, isPlatformAdmin: true, deletedAt: null });

describe.sequential("Phase 15 billing and financial integrity", () => {
  beforeAll(async () => {
    const users = await Promise.all([
      setup.user.create({ data: { email: `p15-a-${suffix}@test.invalid`, name: "P15 A", passwordHash: "test", emailVerifiedAt: new Date() } }),
      setup.user.create({ data: { email: `p15-b-${suffix}@test.invalid`, name: "P15 B", passwordHash: "test", emailVerifiedAt: new Date() } }),
      setup.user.create({ data: { email: `p15-fin-${suffix}@test.invalid`, name: "P15 Finance", passwordHash: "test", emailVerifiedAt: new Date(), isPlatformAdmin: true } }),
    ]); userA = users[0].id; userB = users[1].id; financeId = users[2].id;
    const orgs = await Promise.all([
      setup.organization.create({ data: { name: "P15 Tenant A", slug: `p15-a-${suffix}`, status: "ACTIVE", ownerId: userA, contactEmail: users[0].email } }),
      setup.organization.create({ data: { name: "P15 Tenant B", slug: `p15-b-${suffix}`, status: "ACTIVE", ownerId: userB, contactEmail: users[1].email } }),
    ]); orgA = orgs[0].id; orgB = orgs[1].id;
    const permissions = await Promise.all(["organization.billing.view", "organization.billing.manage", "organization.refund.request"].map((key) => setup.permission.upsert({ where: { key }, update: {}, create: { key, description: key } })));
    for (const [organizationId, userId] of [[orgA, userA], [orgB, userB]]) { const role = await setup.role.create({ data: { organizationId, name: "Owner", key: "organization-owner", permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } }); await setup.organizationMember.create({ data: { organizationId, userId, roleId: role.id } }); await setup.organizationSubscription.create({ data: { organizationId, planVersionId: "pv_free_v1", status: "ACTIVE", reason: "P15 TEST" } }); }
    await setup.platformPermissionGrant.createMany({ data: ["finance.billing.view", "finance.billing.manage"].map((permission) => ({ userId: financeId, permission, grantedById: financeId, reason: "P15 TEST" })) });
    await setup.competition.create({ data: { organizationId: orgA, name: "P15 Cup", slug: `p15-cup-${suffix}`, format: "SINGLE_ROUND_ROBIN", status: "DRAFT" } });
  });

  afterAll(async () => {
    const organizations = [orgA, orgB].filter(Boolean); const users = [userA, userB, financeId].filter(Boolean);
    await setup.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('app.allow_financial_purge','true',true)`; await tx.reconciliationCase.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.billingAudit.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.creditNote.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.refund.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.paymentEvent.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.paymentTransaction.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.paymentAttempt.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.invoiceItem.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.invoice.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.billingOrder.deleteMany({ where: { organizationId: { in: organizations } } }); await tx.billingAccount.deleteMany({ where: { organizationId: { in: organizations } } }); }); await setup.competitionEntitlement.deleteMany({ where: { organizationId: { in: organizations } } }); await setup.subscriptionAudit.deleteMany({ where: { organizationId: { in: organizations } } }); await setup.organizationSubscription.deleteMany({ where: { organizationId: { in: organizations } } }); await setup.auditLog.deleteMany({ where: { OR: [{ organizationId: { in: organizations } }, { actorId: { in: users } }] } }); await setup.competition.deleteMany({ where: { organizationId: { in: organizations } } }); await setup.platformPermissionGrant.deleteMany({ where: { userId: { in: users } } }); await setup.organization.deleteMany({ where: { id: { in: organizations } } }); await setup.user.deleteMany({ where: { id: { in: users } } }); await runtime?.$disconnect(); if (setup !== db) await setup.$disconnect();
  });

  it("creates one immutable server-priced order under concurrent checkout", async () => {
    const input = { organizationId: orgA, planCode: "ORGANIZER_PRO", version: 1, idempotencyKey: `checkout-${suffix}`, amountMinor: "1" };
    const [a, b] = await Promise.all([createCheckout(actorA(), input), createCheckout(actorA(), input)]);
    if (!a.invoice || !b.invoice) throw new Error("Invoice checkout tidak terbentuk.");
    expect(a.invoice.totalMinor).toBe("350000000"); expect(b.invoice.id).toBe(a.invoice.id);
    expect(await setup.billingOrder.count({ where: { organizationId: orgA } })).toBe(1);
    await expect(setup.invoice.update({ where: { id: a.invoice.id }, data: { totalMinor: BigInt(1) } })).rejects.toBeTruthy();
  });

  it("rejects forged/mismatched webhooks and applies a verified payment exactly once", async () => {
    const attempt = await setup.paymentAttempt.findFirstOrThrow({ where: { organizationId: orgA } });
    const signed = mockPaymentProvider.createEvent({ paymentId: attempt.externalPaymentId, amountMinor: attempt.amountMinor, status: "PAID", eventId: `evt-paid-${suffix}`, transactionId: `tx-paid-${suffix}` });
    await expect(processMockWebhook(signed.rawBody, "0".repeat(64))).rejects.toMatchObject({ status: 401 });
    const mismatch = mockPaymentProvider.createEvent({ paymentId: attempt.externalPaymentId, amountMinor: BigInt(1), status: "PAID", eventId: `evt-mismatch-${suffix}` });
    expect(await processMockWebhook(mismatch.rawBody, mismatch.signature)).toMatchObject({ rejected: true, reason: "AMOUNT_OR_CURRENCY_MISMATCH" });
    const concurrent = await Promise.all([processMockWebhook(signed.rawBody, signed.signature), processMockWebhook(signed.rawBody, signed.signature)]);
    expect(concurrent.filter((result) => result.duplicate === false)).toHaveLength(1);
    expect(concurrent.filter((result) => result.duplicate === true)).toHaveLength(1);
    const order = await setup.billingOrder.findFirstOrThrow({ where: { organizationId: orgA } }); expect(order.activationAppliedAt).not.toBeNull();
    expect((await setup.organizationSubscription.findUniqueOrThrow({ where: { organizationId: orgA }, include: { planVersion: { include: { plan: true } } } })).planVersion.plan.code).toBe("ORGANIZER_PRO");
    expect(await setup.paymentTransaction.count({ where: { organizationId: orgA, status: "PAID" } })).toBe(1);
  });

  it("blocks out-of-order rollback and cross-tenant invoice access", async () => {
    const attempt = await setup.paymentAttempt.findFirstOrThrow({ where: { organizationId: orgA } }); const late = mockPaymentProvider.createEvent({ paymentId: attempt.externalPaymentId, amountMinor: attempt.amountMinor, status: "FAILED", eventId: `evt-late-${suffix}` });
    expect(await processMockWebhook(late.rawBody, late.signature)).toMatchObject({ ignored: true });
    const invoice = await setup.invoice.findFirstOrThrow({ where: { organizationId: orgA } });
    await expect(invoiceDetail({ id: userB, isActive: true, isPlatformAdmin: false, deletedAt: null }, orgA, invoice.id)).rejects.toMatchObject({ status: 403 });
  });

  it("rolls back checkout when the provider remains unavailable after retry", async () => {
    process.env.PAYMENT_MOCK_FORCE_OUTAGE = "1";
    try { await expect(createCheckout(actorB(), { organizationId: orgB, planCode: "ORGANIZER_PRO", version: 1, idempotencyKey: `outage-${suffix}` })).rejects.toThrow("MOCK_PROVIDER_UNAVAILABLE"); }
    finally { delete process.env.PAYMENT_MOCK_FORCE_OUTAGE; }
    expect(await setup.billingOrder.count({ where: { organizationId: orgB } })).toBe(0);
    expect(await setup.invoice.count({ where: { organizationId: orgB } })).toBe(0);
  });

  it("rejects plan tampering and expires payment without activating access", async () => {
    await expect(createCheckout(actorB(), { organizationId: orgB, planCode: "FREE", version: 1, idempotencyKey: `tamper-${suffix}` })).rejects.toBeTruthy();
    await expect(createCheckout(actorB(), { organizationId: orgB, planCode: "ORGANIZER_PRO", version: 999, idempotencyKey: `version-${suffix}` })).rejects.toMatchObject({ status: 404 });
    await createCheckout(actorB(), { organizationId: orgB, planCode: "ORGANIZER_PRO", version: 1, idempotencyKey: `expiry-${suffix}` });
    const order = await setup.billingOrder.findUniqueOrThrow({ where: { organizationId_idempotencyKey: { organizationId: orgB, idempotencyKey: `expiry-${suffix}` } }, include: { attempts: true } });
    await simulatePayment(actorB(), orgB, order.attempts[0].id, "EXPIRED");
    expect((await setup.billingOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("EXPIRED");
    expect((await setup.organizationSubscription.findUniqueOrThrow({ where: { organizationId: orgB }, include: { planVersion: { include: { plan: true } } } })).planVersion.plan.code).toBe("FREE");
  });

  it("runs idempotent full refund, credit note, subscription adjustment, and reconciliation", async () => {
    const transaction = await setup.paymentTransaction.findFirstOrThrow({ where: { organizationId: orgA } });
    await expect(requestRefund(actorB(), { organizationId: orgA, transactionId: transaction.id, amountMinor: transaction.amountMinor.toString(), reason: "Unauthorized cross tenant request", idempotencyKey: `refund-denied-${suffix}` })).rejects.toMatchObject({ status: 403 });
    const requested = await requestRefund(actorA(), { organizationId: orgA, transactionId: transaction.id, amountMinor: transaction.amountMinor.toString(), reason: "Duplicate organizer sandbox purchase", idempotencyKey: `refund-${suffix}` });
    const approved = await approveRefund(finance(), requested.id, "Approved full sandbox refund request"); expect(approved.status).toBe("SUCCEEDED");
    expect((await approveRefund(finance(), requested.id, "Idempotent refund approval retry")).status).toBe("SUCCEEDED");
    expect(await setup.creditNote.count({ where: { refundId: requested.id } })).toBe(1);
    expect((await setup.organizationSubscription.findUniqueOrThrow({ where: { organizationId: orgA } })).status).toBe("CANCELED");
    const invoice = await setup.invoice.findFirstOrThrow({ where: { organizationId: orgA } }); expect((await reconcileInvoice(finance(), invoice.id)).issueCode).toBeTruthy();
  });

  it("activates Tournament only for the purchased competition", async () => {
    const competition = await setup.competition.findFirstOrThrow({ where: { organizationId: orgA } });
    const checkout = await createCheckout(actorA(), { organizationId: orgA, planCode: "TOURNAMENT", version: 1, competitionId: competition.id, idempotencyKey: `tournament-${suffix}` });
    if (!checkout.invoice) throw new Error("Invoice Tournament tidak terbentuk.");
    const attempt = await setup.paymentAttempt.findFirstOrThrow({ where: { invoiceId: checkout.invoice.id } });
    const signed = mockPaymentProvider.createEvent({ paymentId: attempt.externalPaymentId, amountMinor: attempt.amountMinor, status: "PAID", eventId: `evt-tournament-${suffix}` });
    await processMockWebhook(signed.rawBody, signed.signature);
    expect(await setup.competitionEntitlement.count({ where: { organizationId: orgA, competitionId: competition.id, planVersionId: "pv_tournament_v1", status: "ACTIVE" } })).toBe(1);
    expect((await setup.organizationSubscription.findUniqueOrThrow({ where: { organizationId: orgA } })).status).toBe("CANCELED");
  });

  it("keeps scoped access after a partial refund and cancels it only after the remainder", async () => {
    const transaction = await setup.paymentTransaction.findFirstOrThrow({ where: { organizationId: orgA, order: { competitionId: { not: null } }, status: "PAID" } });
    const firstAmount = transaction.amountMinor / BigInt(2);
    const first = await requestRefund(actorA(), { organizationId: orgA, transactionId: transaction.id, amountMinor: firstAmount.toString(), reason: "Approved partial sandbox refund", idempotencyKey: `refund-partial-${suffix}` });
    await approveRefund(finance(), first.id, "Approved partial sandbox refund");
    expect((await setup.paymentTransaction.findUniqueOrThrow({ where: { id: transaction.id } })).status).toBe("PARTIALLY_REFUNDED");
    expect(await setup.competitionEntitlement.count({ where: { organizationId: orgA, status: "ACTIVE" } })).toBe(1);
    const remainder = transaction.amountMinor - firstAmount;
    const second = await requestRefund(actorA(), { organizationId: orgA, transactionId: transaction.id, amountMinor: remainder.toString(), reason: "Approved remaining sandbox refund", idempotencyKey: `refund-remainder-${suffix}` });
    await approveRefund(finance(), second.id, "Approved remaining sandbox refund");
    expect((await setup.paymentTransaction.findUniqueOrThrow({ where: { id: transaction.id } })).status).toBe("REFUNDED");
    expect(await setup.competitionEntitlement.count({ where: { organizationId: orgA, status: "ACTIVE" } })).toBe(0);
  });

  it.skipIf(!runtime)("default-denies finance rows without tenant context", async () => {
    expect(await runtime!.invoice.count()).toBe(0); expect(await runtime!.paymentTransaction.count()).toBe(0);
    const [expectedA, expectedB] = await Promise.all([setup.invoice.count({ where: { organizationId: orgA } }), setup.invoice.count({ where: { organizationId: orgB } })]);
    expect(await withTenantDatabase(runtime!, orgA, () => db.invoice.count())).toBe(expectedA);
    expect(await withTenantDatabase(runtime!, orgB, () => db.invoice.count())).toBe(expectedB);
  });
});
