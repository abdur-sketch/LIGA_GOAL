import { createHash } from "node:crypto";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { db, rootDb } from "@/lib/db";
import { withPlatformDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { mockEventSchema, mockPaymentProvider, payloadHash, providerCall, signatureDigest, verifyMockWebhook } from "./provider";

const checkoutSchema = z.object({ organizationId: z.string().min(1), planCode: z.enum(["TOURNAMENT", "PRO_LEAGUE", "ORGANIZER_PRO", "ENTERPRISE"]), version: z.number().int().positive().default(1), competitionId: z.string().min(1).optional(), seasonId: z.string().min(1).optional(), idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{8,160}$/) });
const refundSchema = z.object({ organizationId: z.string().min(1), transactionId: z.string().min(1), amountMinor: z.string().regex(/^\d+$/), reason: z.string().trim().min(8).max(500), idempotencyKey: z.string().regex(/^[A-Za-z0-9:_-]{8,160}$/) });

function json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item)) as Prisma.InputJsonValue; }
export function financialJson<T>(value: T): T { return JSON.parse(JSON.stringify(value, (_, item) => typeof item === "bigint" ? item.toString() : item)) as T; }
function nowCode(date = new Date()) { return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }

async function requireFinance(actor: ApiActor, permission: "finance.billing.view" | "finance.billing.manage") {
  if (!actor.isPlatformAdmin) throw new ApiError(403, "Akses platform finance diperlukan.");
  const grant = await withPlatformDatabase(rootDb, () => db.platformPermissionGrant.findUnique({ where: { userId_permission: { userId: actor.id, permission } } }));
  if (!grant) throw new ApiError(403, "Permission platform finance tidak tersedia.");
}

function catalogAmount(priceConfig: Prisma.JsonValue) {
  const value = priceConfig as { amountMinor?: unknown; accessDays?: unknown; taxMode?: unknown };
  if (!Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) <= 0) throw new ApiError(422, "Harga katalog belum dapat ditagihkan.");
  return { amountMinor: BigInt(Number(value.amountMinor)), accessDays: Number.isInteger(value.accessDays) ? Number(value.accessDays) : null, taxMode: typeof value.taxMode === "string" ? value.taxMode : "configured" };
}

export async function createCheckout(actor: ApiActor, raw: unknown) {
  const input = checkoutSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "organization.billing.manage");
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`checkout:${input.organizationId}:${input.idempotencyKey}`}))`;
    const existing = await db.billingOrder.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } }, include: { invoice: true, attempts: true } });
    if (existing) return financialJson(existing);
    const planVersion = await db.planVersion.findFirst({ where: { plan: { code: input.planCode, isActive: true }, version: input.version, isActive: true, effectiveFrom: { lte: new Date() }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] }, include: { plan: true, features: true } });
    if (!planVersion) throw new ApiError(404, "Paket atau versi tidak tersedia.");
    if (["TOURNAMENT", "PRO_LEAGUE"].includes(input.planCode) && !input.competitionId) throw new ApiError(422, "Kompetisi wajib dipilih untuk paket ini.");
    const competition = input.competitionId ? await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null } }) : null;
    if (input.competitionId && !competition) throw new ApiError(404, "Kompetisi tidak ditemukan pada organisasi ini.");
    if (input.seasonId && !await db.season.findFirst({ where: { id: input.seasonId, competitionId: input.competitionId } })) throw new ApiError(404, "Musim tidak sesuai dengan kompetisi.");
    const organization = await db.organization.findFirstOrThrow({ where: { id: input.organizationId }, select: { name: true, contactEmail: true, address: true } });
    const price = catalogAmount(planVersion.priceConfig);
    const account = await db.billingAccount.upsert({ where: { organizationId: input.organizationId }, update: {}, create: { organizationId: input.organizationId, legalName: organization.name, billingEmail: organization.contactEmail ?? "billing-unset@local.invalid", taxProfile: { mode: price.taxMode, rateBps: 0, status: "OWNER_REVIEW_REQUIRED" }, currency: "IDR" } });
    const order = await db.billingOrder.create({ data: { organizationId: input.organizationId, billingAccountId: account.id, planVersionId: planVersion.id, competitionId: input.competitionId, seasonId: input.seasonId, idempotencyKey: input.idempotencyKey, status: "CREATED", amountMinor: price.amountMinor, catalogSnapshot: json({ planCode: planVersion.plan.code, version: planVersion.version, displayName: planVersion.displayName, billingModel: planVersion.billingModel, priceConfig: planVersion.priceConfig, accessDays: price.accessDays }) } });
    const invoice = await db.invoice.create({ data: { organizationId: input.organizationId, billingAccountId: account.id, orderId: order.id, invoiceNumber: `LG-${nowCode()}-${order.id.toUpperCase()}`, status: "OPEN", currency: "IDR", subtotalMinor: price.amountMinor, totalMinor: price.amountMinor, taxSnapshot: json(account.taxProfile), sellerSnapshot: { legalName: "LIGA GOAL", status: "LEGAL_REVIEW_REQUIRED" }, buyerSnapshot: { legalName: account.legalName, billingEmail: account.billingEmail, address: organization.address }, issuedAt: new Date(), dueAt: new Date(Date.now() + 24 * 60 * 60_000), items: { create: { organizationId: input.organizationId, planVersionId: planVersion.id, competitionId: input.competitionId, seasonId: input.seasonId, description: `${planVersion.displayName} v${planVersion.version}${competition ? ` — ${competition.name}` : ""}`, quantity: 1, unitAmountMinor: price.amountMinor, subtotalMinor: price.amountMinor, taxClass: "CONFIGURED", snapshot: json({ planCode: planVersion.plan.code, version: planVersion.version, priceConfig: planVersion.priceConfig }) } } } });
    const provider = await providerCall(() => mockPaymentProvider.createPayment({ amountMinor: price.amountMinor, currency: "IDR", idempotencyKey: `attempt:${input.idempotencyKey}` }));
    const attempt = await db.paymentAttempt.create({ data: { organizationId: input.organizationId, orderId: order.id, invoiceId: invoice.id, provider: mockPaymentProvider.code, externalPaymentId: provider.externalPaymentId, idempotencyKey: `attempt:${input.idempotencyKey}`, status: "PENDING", amountMinor: price.amountMinor, currency: "IDR", checkoutReference: provider.checkoutReference, expiresAt: provider.expiresAt, lastProviderStatus: provider.status } });
    await db.billingOrder.update({ where: { id: order.id }, data: { status: "PAYMENT_PENDING" } });
    await db.billingAudit.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "CHECKOUT_CREATED", resourceType: "BillingOrder", resourceId: order.id, reason: "Organizer initiated local simulation checkout", after: json({ invoiceId: invoice.id, attemptId: attempt.id, planVersionId: planVersion.id, amountMinor: price.amountMinor }) } });
    return financialJson({ order: { ...order, status: "PAYMENT_PENDING" }, invoice, attempt });
  });
}

const terminalAttempt = new Set(["SUCCEEDED", "EXPIRED", "CANCELED"]);
function mappedAttempt(status: string) { return status === "PAID" ? "SUCCEEDED" : status; }
function mappedTransaction(status: string) { return status === "SUCCEEDED" ? "PAID" : status; }

async function activatePaidOrder(orderId: string, eventId: string) {
  const order = await db.billingOrder.findUniqueOrThrow({ where: { id: orderId }, include: { planVersion: { include: { plan: true } } } });
  if (order.activationAppliedAt) return false;
  const snapshot = order.catalogSnapshot as { accessDays?: number | null };
  const accessDays = snapshot.accessDays ?? (order.planVersion.billingModel === "RECURRING" ? 30 : 120);
  const endsAt = new Date(Date.now() + accessDays * 86_400_000);
  if (order.competitionId && ["TOURNAMENT", "PRO_LEAGUE"].includes(order.planVersion.plan.code)) {
    const current = await db.competitionEntitlement.findFirst({ where: { organizationId: order.organizationId, competitionId: order.competitionId, seasonId: order.seasonId ?? null, planVersionId: order.planVersionId, status: "ACTIVE" } });
    if (current) await db.competitionEntitlement.update({ where: { id: current.id }, data: { endsAt: new Date(Math.max(current.endsAt.valueOf(), Date.now()) + accessDays * 86_400_000), reason: `VERIFIED_PAYMENT:${eventId}` } });
    else await db.competitionEntitlement.create({ data: { organizationId: order.organizationId, competitionId: order.competitionId, seasonId: order.seasonId, planVersionId: order.planVersionId, status: "ACTIVE", startsAt: new Date(), endsAt, reason: `VERIFIED_PAYMENT:${eventId}` } });
  } else {
    await db.organizationSubscription.upsert({ where: { organizationId: order.organizationId }, update: { planVersionId: order.planVersionId, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: endsAt, reason: `VERIFIED_PAYMENT:${eventId}`, version: { increment: 1 } }, create: { organizationId: order.organizationId, planVersionId: order.planVersionId, status: "ACTIVE", currentPeriodStart: new Date(), currentPeriodEnd: endsAt, reason: `VERIFIED_PAYMENT:${eventId}` } });
  }
  await db.billingOrder.update({ where: { id: order.id }, data: { status: "PAID", activationAppliedAt: new Date() } });
  await db.billingAudit.create({ data: { organizationId: order.organizationId, action: "SUBSCRIPTION_ACTIVATED", resourceType: "BillingOrder", resourceId: order.id, reason: `Verified mock payment event ${eventId}`, after: json({ planVersionId: order.planVersionId, competitionId: order.competitionId, seasonId: order.seasonId, endsAt }) } });
  return true;
}

export async function processMockWebhook(rawBody: string, signature: string | null) {
  if (Buffer.byteLength(rawBody) > 64 * 1024) throw new ApiError(413, "Payload webhook terlalu besar.");
  if (!verifyMockWebhook(rawBody, signature)) throw new ApiError(401, "Signature webhook tidak valid.");
  const event = mockEventSchema.parse(JSON.parse(rawBody));
  const attemptScope = await withPlatformDatabase(rootDb, () => db.paymentAttempt.findUnique({ where: { externalPaymentId: event.paymentId }, select: { organizationId: true } }));
  if (!attemptScope) throw new ApiError(404, "Payment attempt tidak dikenal.");
  return withTenantDatabase(rootDb, attemptScope.organizationId, async () => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment:${event.paymentId}`}))`;
    const duplicate = await db.paymentEvent.findUnique({ where: { provider_externalEventId: { provider: mockPaymentProvider.code, externalEventId: event.eventId } } });
    if (duplicate) return { duplicate: true, eventId: duplicate.id, status: duplicate.status };
    const attempt = await db.paymentAttempt.findUniqueOrThrow({ where: { externalPaymentId: event.paymentId }, include: { invoice: true, order: true } });
    const amount = BigInt(event.amountMinor);
    if (amount !== attempt.amountMinor || event.currency !== attempt.currency) {
      const rejected = await db.paymentEvent.create({ data: { organizationId: attempt.organizationId, attemptId: attempt.id, provider: mockPaymentProvider.code, externalEventId: event.eventId, eventType: `PAYMENT_${event.status}`, status: "REJECTED", payloadHash: payloadHash(rawBody), signatureDigest: signatureDigest(signature!), normalizedPayload: json(event), processedAt: new Date(), errorCode: "AMOUNT_OR_CURRENCY_MISMATCH" } });
      await db.billingAudit.create({ data: { organizationId: attempt.organizationId, action: "PAYMENT_EVENT_REJECTED", resourceType: "PaymentEvent", resourceId: rejected.id, reason: "Amount or currency mismatch", after: json({ eventId: event.eventId, errorCode: "AMOUNT_OR_CURRENCY_MISMATCH" }) } });
      return { duplicate: false, rejected: true, reason: "AMOUNT_OR_CURRENCY_MISMATCH" };
    }
    const targetAttempt = mappedAttempt(event.status);
    if (terminalAttempt.has(attempt.status) && attempt.status !== targetAttempt) {
      await db.paymentEvent.create({ data: { organizationId: attempt.organizationId, attemptId: attempt.id, provider: mockPaymentProvider.code, externalEventId: event.eventId, eventType: `PAYMENT_${event.status}`, status: "REJECTED", payloadHash: payloadHash(rawBody), signatureDigest: signatureDigest(signature!), normalizedPayload: json(event), processedAt: new Date(), errorCode: "INVALID_OUT_OF_ORDER_TRANSITION" } });
      return { duplicate: false, ignored: true, reason: "INVALID_OUT_OF_ORDER_TRANSITION" };
    }
    const paymentEvent = await db.paymentEvent.create({ data: { organizationId: attempt.organizationId, attemptId: attempt.id, provider: mockPaymentProvider.code, externalEventId: event.eventId, eventType: `PAYMENT_${event.status}`, status: "VERIFIED", payloadHash: payloadHash(rawBody), signatureDigest: signatureDigest(signature!), normalizedPayload: json(event) } });
    const attemptStatus = targetAttempt as "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED" | "CANCELED";
    await db.paymentAttempt.update({ where: { id: attempt.id }, data: { status: attemptStatus, lastProviderStatus: event.status, failureCode: event.status === "FAILED" ? "MOCK_DECLINED" : null } });
    const txStatus = mappedTransaction(attemptStatus) as "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "CANCELED";
    await db.paymentTransaction.upsert({ where: { externalTransactionId: event.transactionId }, update: {}, create: { organizationId: attempt.organizationId, orderId: attempt.orderId, invoiceId: attempt.invoiceId, attemptId: attempt.id, externalTransactionId: event.transactionId, status: txStatus, amountMinor: amount, currency: event.currency, paidAt: txStatus === "PAID" ? new Date(event.occurredAt) : null, providerSnapshot: json(event) } });
    if (attemptStatus === "SUCCEEDED") {
      await db.invoice.update({ where: { id: attempt.invoiceId }, data: { status: "PAID", paidAt: new Date(event.occurredAt) } });
      await activatePaidOrder(attempt.orderId, event.eventId);
    } else if (attemptStatus === "EXPIRED") await db.billingOrder.update({ where: { id: attempt.orderId }, data: { status: "EXPIRED" } });
    else if (attemptStatus === "CANCELED") await db.billingOrder.update({ where: { id: attempt.orderId }, data: { status: "CANCELED" } });
    await db.paymentEvent.update({ where: { id: paymentEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
    await db.billingAudit.create({ data: { organizationId: attempt.organizationId, action: "PAYMENT_EVENT_PROCESSED", resourceType: "PaymentEvent", resourceId: paymentEvent.id, reason: "Cryptographically verified local mock event", after: json({ status: event.status, invoiceId: attempt.invoiceId }) } });
    return { duplicate: false, eventId: paymentEvent.id, status: "PROCESSED", paymentStatus: event.status };
  });
}

export async function simulatePayment(actor: ApiActor, organizationId: string, attemptId: string, status: "PAID" | "FAILED" | "EXPIRED") {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "organization.billing.manage");
    const attempt = await db.paymentAttempt.findFirst({ where: { id: attemptId, organizationId } });
    if (!attempt) throw new ApiError(404, "Payment attempt tidak ditemukan.");
    const signed = mockPaymentProvider.createEvent({ paymentId: attempt.externalPaymentId, amountMinor: attempt.amountMinor, status });
    return processMockWebhook(signed.rawBody, signed.signature);
  });
}

export async function tenantBilling(actor: ApiActor, organizationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "organization.billing.view");
    const [account, orders, invoices, transactions, refunds] = await Promise.all([
      db.billingAccount.findUnique({ where: { organizationId } }),
      db.billingOrder.findMany({ where: { organizationId }, include: { planVersion: { include: { plan: true } }, attempts: true }, orderBy: { createdAt: "desc" } }),
      db.invoice.findMany({ where: { organizationId }, include: { items: true }, orderBy: { createdAt: "desc" } }),
      db.paymentTransaction.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
      db.refund.findMany({ where: { organizationId }, include: { creditNote: true }, orderBy: { createdAt: "desc" } }),
    ]);
    return financialJson({ account, orders, invoices, transactions, refunds });
  });
}

export async function invoiceDetail(actor: ApiActor, organizationId: string, invoiceId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "organization.billing.view");
    const invoice = await db.invoice.findFirst({ where: { id: invoiceId, organizationId }, include: { items: true, transactions: true, refunds: { include: { creditNote: true } }, order: { include: { planVersion: { include: { plan: true } } } } } });
    if (!invoice) throw new ApiError(404, "Invoice tidak ditemukan.");
    return financialJson(invoice);
  });
}

export async function requestRefund(actor: ApiActor, raw: unknown) {
  const input = refundSchema.parse(raw); const amountMinor = BigInt(input.amountMinor);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "organization.refund.request");
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${input.organizationId}:${input.transactionId}`}))`;
    const existing = await db.refund.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return financialJson(existing);
    const transaction = await db.paymentTransaction.findFirst({ where: { id: input.transactionId, organizationId: input.organizationId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
    if (!transaction) throw new ApiError(404, "Transaksi yang dapat direfund tidak ditemukan.");
    if (amountMinor <= BigInt(0) || amountMinor > transaction.amountMinor - transaction.refundedMinor) throw new ApiError(422, "Nilai refund melebihi saldo transaksi.");
    const refund = await db.refund.create({ data: { organizationId: input.organizationId, orderId: transaction.orderId, invoiceId: transaction.invoiceId, transactionId: transaction.id, idempotencyKey: input.idempotencyKey, amountMinor, reason: input.reason, provider: mockPaymentProvider.code, requestedById: actor.id } });
    await db.billingAudit.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "REFUND_REQUESTED", resourceType: "Refund", resourceId: refund.id, reason: input.reason, after: json(refund) } });
    return financialJson(refund);
  });
}

export async function approveRefund(actor: ApiActor, refundId: string, reason: string) {
  await requireFinance(actor, "finance.billing.manage"); if (reason.trim().length < 8) throw new ApiError(422, "Alasan persetujuan refund wajib diisi.");
  const scope = await withPlatformDatabase(rootDb, () => db.refund.findUnique({ where: { id: refundId }, select: { organizationId: true } }));
  if (!scope) throw new ApiError(404, "Refund tidak ditemukan.");
  return withTenantDatabase(rootDb, scope.organizationId, async () => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund-approval:${refundId}`}))`;
    const refund = await db.refund.findUniqueOrThrow({ where: { id: refundId }, include: { transaction: true, invoice: true, order: { include: { planVersion: { include: { plan: true } } } } } });
    if (refund.status === "SUCCEEDED") return financialJson(refund);
    if (refund.status !== "REQUESTED") throw new ApiError(409, "Status refund tidak dapat disetujui.");
    const provider = await providerCall(() => mockPaymentProvider.refund({ amountMinor: refund.amountMinor, transactionId: refund.transaction.externalTransactionId, idempotencyKey: refund.idempotencyKey }));
    const newRefunded = refund.transaction.refundedMinor + refund.amountMinor; const full = newRefunded === refund.transaction.amountMinor;
    await db.paymentTransaction.update({ where: { id: refund.transactionId }, data: { refundedMinor: newRefunded, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    await db.invoice.update({ where: { id: refund.invoiceId }, data: { refundedMinor: { increment: refund.amountMinor }, status: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    const completed = await db.refund.update({ where: { id: refund.id }, data: { status: "SUCCEEDED", externalRefundId: provider.externalRefundId, reviewedById: actor.id, reviewedAt: new Date(), completedAt: new Date() } });
    await db.creditNote.create({ data: { organizationId: refund.organizationId, invoiceId: refund.invoiceId, refundId: refund.id, creditNoteNumber: `CN-${nowCode()}-${refund.id.toUpperCase()}`, amountMinor: refund.amountMinor, reason: refund.reason, snapshot: json({ invoiceNumber: refund.invoice.invoiceNumber, transactionId: refund.transaction.externalTransactionId, approvalReason: reason }) } });
    if (full) {
      if (refund.order.competitionId) await db.competitionEntitlement.updateMany({ where: { organizationId: refund.organizationId, competitionId: refund.order.competitionId, planVersionId: refund.order.planVersionId, status: "ACTIVE" }, data: { status: "CANCELED", endsAt: new Date(), reason: `FULL_REFUND:${refund.id}` } });
      else await db.organizationSubscription.updateMany({ where: { organizationId: refund.organizationId, planVersionId: refund.order.planVersionId }, data: { status: "CANCELED", canceledAt: new Date(), reason: `FULL_REFUND:${refund.id}`, version: { increment: 1 } } });
    }
    await db.billingAudit.create({ data: { organizationId: refund.organizationId, actorId: actor.id, action: "REFUND_SUCCEEDED", resourceType: "Refund", resourceId: refund.id, reason, before: json(refund), after: json(completed) } });
    return financialJson(completed);
  });
}

export async function reconcileInvoice(actor: ApiActor, invoiceId: string) {
  await requireFinance(actor, "finance.billing.manage");
  const scope = await withPlatformDatabase(rootDb, () => db.invoice.findUnique({ where: { id: invoiceId }, select: { organizationId: true } }));
  if (!scope) throw new ApiError(404, "Invoice tidak ditemukan.");
  return withTenantDatabase(rootDb, scope.organizationId, async () => {
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { attempts: true, transactions: true, order: true } });
    const paid = invoice.transactions.filter((item) => item.status === "PAID" || item.status === "PARTIALLY_REFUNDED" || item.status === "REFUNDED");
    const paidTotal = paid.reduce((sum, item) => sum + item.amountMinor, BigInt(0));
    const provider = invoice.attempts[0] ? await providerCall(() => mockPaymentProvider.inquiry({ externalPaymentId: invoice.attempts[0].externalPaymentId, lastStatus: invoice.attempts[0].lastProviderStatus })) : { externalPaymentId: "none", status: "MISSING_ATTEMPT", source: "LOCAL_LEDGER" };
    let issueCode = "MATCHED"; let status: "MATCHED" | "MISMATCH" | "MISSING_PROVIDER_EVENT" | "INCORRECT_ACTIVATION" = "MATCHED";
    if (invoice.status === "PAID" && paidTotal !== invoice.totalMinor) { issueCode = "PAID_TOTAL_MISMATCH"; status = "MISMATCH"; }
    else if (provider.status === "PAID" && invoice.status !== "PAID") { issueCode = "MISSING_PAID_WEBHOOK"; status = "MISSING_PROVIDER_EVENT"; }
    else if (invoice.order.activationAppliedAt && invoice.status !== "PAID" && invoice.status !== "REFUNDED") { issueCode = "ACTIVATION_WITHOUT_PAID_INVOICE"; status = "INCORRECT_ACTIVATION"; }
    const fingerprint = createHash("sha256").update(`${invoice.id}:${issueCode}:${invoice.status}:${paidTotal}`).digest("hex");
    const result = await db.reconciliationCase.upsert({ where: { organizationId_fingerprint: { organizationId: invoice.organizationId, fingerprint } }, update: { providerState: json(provider) }, create: { organizationId: invoice.organizationId, invoiceId: invoice.id, fingerprint, status, issueCode, internalState: json({ invoiceStatus: invoice.status, totalMinor: invoice.totalMinor, paidTotal, activationAppliedAt: invoice.order.activationAppliedAt }), providerState: json(provider) } });
    await db.billingAudit.create({ data: { organizationId: invoice.organizationId, actorId: actor.id, action: "RECONCILIATION_RUN", resourceType: "ReconciliationCase", resourceId: result.id, reason: "Authorized provider/internal comparison", after: json(result) } });
    return financialJson(result);
  });
}

export async function financeOverview(actor: ApiActor) {
  await requireFinance(actor, "finance.billing.view");
  return withPlatformDatabase(rootDb, async () => financialJson({
    invoices: await db.invoice.findMany({ include: { organization: { select: { name: true, slug: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    transactions: await db.paymentTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    refunds: await db.refund.findMany({ include: { organization: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    reconciliation: await db.reconciliationCase.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    audits: await db.billingAudit.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  }));
}

export function invoiceStateAllows(from: InvoiceStatus, to: InvoiceStatus) {
  const allowed: Record<InvoiceStatus, InvoiceStatus[]> = { DRAFT: ["OPEN", "VOID"], OPEN: ["PAID", "VOID", "UNCOLLECTIBLE"], PAID: ["PARTIALLY_REFUNDED", "REFUNDED"], VOID: [], UNCOLLECTIBLE: ["PAID", "VOID"], PARTIALLY_REFUNDED: ["REFUNDED"], REFUNDED: [] };
  return allowed[from].includes(to);
}
