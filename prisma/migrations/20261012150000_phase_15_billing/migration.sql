-- Phase 15: provider-neutral local billing ledger. No live gateway is enabled.
CREATE TYPE "BillingOrderStatus" AS ENUM ('CREATED','INVOICED','PAYMENT_PENDING','PAID','CANCELED','EXPIRED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT','OPEN','PAID','VOID','UNCOLLECTIBLE','PARTIALLY_REFUNDED','REFUNDED');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED','PENDING','SUCCEEDED','FAILED','EXPIRED','CANCELED');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('CREATED','PENDING','PAID','FAILED','EXPIRED','CANCELED','PARTIALLY_REFUNDED','REFUNDED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('RECEIVED','VERIFIED','PROCESSED','REJECTED','FAILED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED','APPROVED','PROCESSING','SUCCEEDED','FAILED','REJECTED','CANCELED');
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED','VOID');
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED','MISMATCH','MISSING_PROVIDER_EVENT','DUPLICATE_EVENT','INCORRECT_ACTIVATION','MANUAL_REVIEW','RESOLVED');

CREATE TABLE "PlatformPermissionGrant" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "permission" TEXT NOT NULL, "grantedById" TEXT,
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BillingAccount" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "legalName" TEXT NOT NULL, "billingEmail" TEXT NOT NULL,
  "taxProfile" JSONB NOT NULL, "currency" TEXT NOT NULL DEFAULT 'IDR', "providerCustomerRefs" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "BillingOrder" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "billingAccountId" TEXT NOT NULL, "planVersionId" TEXT NOT NULL,
  "competitionId" TEXT, "seasonId" TEXT, "idempotencyKey" TEXT NOT NULL, "status" "BillingOrderStatus" NOT NULL DEFAULT 'CREATED',
  "currency" TEXT NOT NULL DEFAULT 'IDR', "amountMinor" BIGINT NOT NULL, "catalogSnapshot" JSONB NOT NULL,
  "activationAppliedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Invoice" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "billingAccountId" TEXT NOT NULL, "orderId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL, "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT', "currency" TEXT NOT NULL DEFAULT 'IDR',
  "subtotalMinor" BIGINT NOT NULL, "discountMinor" BIGINT NOT NULL DEFAULT 0, "taxMinor" BIGINT NOT NULL DEFAULT 0,
  "totalMinor" BIGINT NOT NULL, "refundedMinor" BIGINT NOT NULL DEFAULT 0, "taxSnapshot" JSONB NOT NULL,
  "sellerSnapshot" JSONB NOT NULL, "buyerSnapshot" JSONB NOT NULL, "issuedAt" TIMESTAMP(3), "dueAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "InvoiceItem" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "planVersionId" TEXT NOT NULL,
  "competitionId" TEXT, "seasonId" TEXT, "description" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmountMinor" BIGINT NOT NULL, "subtotalMinor" BIGINT NOT NULL, "taxClass" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PaymentAttempt" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "externalPaymentId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED', "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'IDR',
  "checkoutReference" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "lastProviderStatus" TEXT, "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PaymentTransaction" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL, "externalTransactionId" TEXT NOT NULL, "status" "PaymentTransactionStatus" NOT NULL,
  "amountMinor" BIGINT NOT NULL, "refundedMinor" BIGINT NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'IDR',
  "paidAt" TIMESTAMP(3), "providerSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "PaymentEvent" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "attemptId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "status" "PaymentEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "payloadHash" TEXT NOT NULL, "signatureDigest" TEXT NOT NULL, "normalizedPayload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "processedAt" TIMESTAMP(3), "errorCode" TEXT
);
CREATE TABLE "Refund" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "orderId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "amountMinor" BIGINT NOT NULL, "reason" TEXT NOT NULL, "provider" TEXT NOT NULL, "externalRefundId" TEXT,
  "requestedById" TEXT NOT NULL, "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "CreditNote" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "refundId" TEXT NOT NULL,
  "creditNoteNumber" TEXT NOT NULL, "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED', "currency" TEXT NOT NULL DEFAULT 'IDR',
  "amountMinor" BIGINT NOT NULL, "reason" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "BillingAudit" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "actorId" TEXT, "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL, "resourceId" TEXT NOT NULL, "reason" TEXT NOT NULL, "before" JSONB, "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ReconciliationCase" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL, "fingerprint" TEXT NOT NULL,
  "status" "ReconciliationStatus" NOT NULL, "issueCode" TEXT NOT NULL, "internalState" JSONB NOT NULL,
  "providerState" JSONB NOT NULL, "resolution" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX "PlatformPermissionGrant_userId_permission_key" ON "PlatformPermissionGrant"("userId","permission");
CREATE INDEX "PlatformPermissionGrant_permission_userId_idx" ON "PlatformPermissionGrant"("permission","userId");
CREATE UNIQUE INDEX "BillingAccount_organizationId_key" ON "BillingAccount"("organizationId");
CREATE INDEX "BillingAccount_organizationId_billingEmail_idx" ON "BillingAccount"("organizationId","billingEmail");
CREATE UNIQUE INDEX "BillingOrder_organizationId_idempotencyKey_key" ON "BillingOrder"("organizationId","idempotencyKey");
CREATE INDEX "BillingOrder_organizationId_status_createdAt_idx" ON "BillingOrder"("organizationId","status","createdAt");
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "Invoice"("orderId"); CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE INDEX "Invoice_organizationId_status_issuedAt_idx" ON "Invoice"("organizationId","status","issuedAt");
CREATE INDEX "InvoiceItem_organizationId_invoiceId_idx" ON "InvoiceItem"("organizationId","invoiceId");
CREATE UNIQUE INDEX "PaymentAttempt_externalPaymentId_key" ON "PaymentAttempt"("externalPaymentId");
CREATE UNIQUE INDEX "PaymentAttempt_organizationId_idempotencyKey_key" ON "PaymentAttempt"("organizationId","idempotencyKey");
CREATE INDEX "PaymentAttempt_organizationId_status_createdAt_idx" ON "PaymentAttempt"("organizationId","status","createdAt");
CREATE UNIQUE INDEX "PaymentTransaction_externalTransactionId_key" ON "PaymentTransaction"("externalTransactionId");
CREATE INDEX "PaymentTransaction_organizationId_status_createdAt_idx" ON "PaymentTransaction"("organizationId","status","createdAt");
CREATE UNIQUE INDEX "PaymentEvent_provider_externalEventId_key" ON "PaymentEvent"("provider","externalEventId");
CREATE INDEX "PaymentEvent_organizationId_status_receivedAt_idx" ON "PaymentEvent"("organizationId","status","receivedAt");
CREATE UNIQUE INDEX "Refund_externalRefundId_key" ON "Refund"("externalRefundId");
CREATE UNIQUE INDEX "Refund_organizationId_idempotencyKey_key" ON "Refund"("organizationId","idempotencyKey");
CREATE INDEX "Refund_organizationId_status_createdAt_idx" ON "Refund"("organizationId","status","createdAt");
CREATE UNIQUE INDEX "CreditNote_refundId_key" ON "CreditNote"("refundId"); CREATE UNIQUE INDEX "CreditNote_creditNoteNumber_key" ON "CreditNote"("creditNoteNumber");
CREATE INDEX "CreditNote_organizationId_issuedAt_idx" ON "CreditNote"("organizationId","issuedAt");
CREATE INDEX "BillingAudit_organizationId_resourceType_resourceId_createdAt_idx" ON "BillingAudit"("organizationId","resourceType","resourceId","createdAt");
CREATE UNIQUE INDEX "ReconciliationCase_organizationId_fingerprint_key" ON "ReconciliationCase"("organizationId","fingerprint");
CREATE INDEX "ReconciliationCase_organizationId_status_createdAt_idx" ON "ReconciliationCase"("organizationId","status","createdAt");

ALTER TABLE "PlatformPermissionGrant" ADD CONSTRAINT "PlatformPermissionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformPermissionGrant" ADD CONSTRAINT "PlatformPermissionGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingOrder" ADD CONSTRAINT "BillingOrder_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "BillingOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingAudit" ADD CONSTRAINT "BillingAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingAudit" ADD CONSTRAINT "BillingAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReconciliationCase" ADD CONSTRAINT "ReconciliationCase_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" (id,key,description) VALUES
 ('phase15_billing_manage','organization.billing.manage','Membuat checkout dan mengelola tagihan organisasi'),
 ('phase15_refund_request','organization.refund.request','Meminta refund simulasi organisasi') ON CONFLICT (key) DO NOTHING;
INSERT INTO "RolePermission" ("roleId","permissionId") SELECT r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
 WHERE r.key IN ('organization-owner','e2e-owner') AND p.key IN ('organization.billing.manage','organization.refund.request') ON CONFLICT DO NOTHING;
INSERT INTO "PlatformPermissionGrant" (id,"userId",permission,"grantedById",reason)
 SELECT 'finance_view_'||id,id,'finance.billing.view',id,'PHASE_15_PLATFORM_FINANCE_BACKFILL' FROM "User" WHERE "isPlatformAdmin"=true ON CONFLICT DO NOTHING;
INSERT INTO "PlatformPermissionGrant" (id,"userId",permission,"grantedById",reason)
 SELECT 'finance_manage_'||id,id,'finance.billing.manage',id,'PHASE_15_PLATFORM_FINANCE_BACKFILL' FROM "User" WHERE "isPlatformAdmin"=true ON CONFLICT DO NOTHING;

-- Issued invoice financial snapshots and lines are immutable. Status/payment/refund timestamps remain append-only workflow fields.
CREATE FUNCTION public.prevent_issued_invoice_financial_rewrite() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF COALESCE(current_setting('app.allow_financial_purge',true),'') <> 'true' AND OLD."issuedAt" IS NOT NULL AND (NEW."invoiceNumber",NEW."organizationId",NEW."billingAccountId",NEW."orderId",NEW.currency,NEW."subtotalMinor",NEW."discountMinor",NEW."taxMinor",NEW."totalMinor",NEW."taxSnapshot",NEW."sellerSnapshot",NEW."buyerSnapshot",NEW."issuedAt",NEW."dueAt") IS DISTINCT FROM (OLD."invoiceNumber",OLD."organizationId",OLD."billingAccountId",OLD."orderId",OLD.currency,OLD."subtotalMinor",OLD."discountMinor",OLD."taxMinor",OLD."totalMinor",OLD."taxSnapshot",OLD."sellerSnapshot",OLD."buyerSnapshot",OLD."issuedAt",OLD."dueAt") THEN RAISE EXCEPTION 'issued invoice financial snapshot is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER invoice_financial_immutable BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION public.prevent_issued_invoice_financial_rewrite();
CREATE FUNCTION public.prevent_issued_invoice_line_change() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE target TEXT; BEGIN target:=COALESCE(NEW."invoiceId",OLD."invoiceId"); IF COALESCE(current_setting('app.allow_financial_purge',true),'') <> 'true' AND EXISTS(SELECT 1 FROM "Invoice" i WHERE i.id=target AND i."issuedAt" IS NOT NULL) THEN RAISE EXCEPTION 'issued invoice lines are immutable'; END IF; RETURN COALESCE(NEW,OLD); END $$;
CREATE TRIGGER invoice_line_immutable BEFORE UPDATE OR DELETE ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION public.prevent_issued_invoice_line_change();

-- Tenant rows use the Phase 11 transaction-local tenant boundary.
ALTER TABLE "PlatformPermissionGrant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY platform_finance_grant ON "PlatformPermissionGrant" FOR ALL USING (current_setting('app.platform_admin',true)='true') WITH CHECK (current_setting('app.platform_admin',true)='true');
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['BillingAccount','BillingOrder','Invoice','InvoiceItem','PaymentAttempt','PaymentTransaction','PaymentEvent','Refund','CreditNote','BillingAudit','ReconciliationCase'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY tenant_default_deny ON %I FOR ALL USING (public.app_tenant_allowed("organizationId")) WITH CHECK (public.app_tenant_allowed("organizationId"))',t);
 END LOOP; END $$;
