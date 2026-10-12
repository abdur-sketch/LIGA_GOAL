# Invoice and Tax Model — Phase 15

## Monetary representation

Every stored amount is PostgreSQL `BIGINT` in minor units. JavaScript calculations use `bigint`; API/UI serialization uses decimal strings. Floating-point arithmetic is prohibited. Invariants:

`subtotal - discount + tax = total` and `0 <= refunded <= paid transaction amount`.

Phase 15 uses quantity 1 and server catalog unit amount. Client price, discount, tax, and total fields are ignored.

## Immutable snapshot

An issued invoice stores unique invoice number, organization/account/order, currency, subtotal/discount/tax/total, tax snapshot, seller snapshot, buyer snapshot, issue/due dates, and line snapshots referencing exact plan/version and competition/season. PostgreSQL triggers reject changes to issued financial fields and updates/deletes of issued lines. Workflow fields—status, paid time, and refunded total—may advance through audited services.

PDF generation reads the stored snapshot and is labeled **SANDBOX / SIMULASI — BUKAN BUKTI PEMBAYARAN NYATA**. It is not a legally approved Indonesian tax invoice.

## Tax configuration

`BillingAccount.taxProfile` and `Invoice.taxSnapshot` are JSON configuration. Current local records use rate 0 with `OWNER_REVIEW_REQUIRED`, preserving the catalog tax mode without assuming taxable treatment. Before commercial use, finance/legal must approve seller identity, NPWP/PKP status, tax-inclusive/exclusive presentation, rounding/allocation, invoice numbering, credit-note form, retention, and e-Faktur obligations.

Price changes create a new PlanVersion. Existing invoice and item snapshots never follow later catalog changes.
