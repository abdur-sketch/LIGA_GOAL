# Financial Reconciliation — Phase 15

The reconciliation service compares immutable invoice total/status, normalized transactions, refund totals, provider inquiry status, and `activationAppliedAt`. It emits a deterministic fingerprint so the same mismatch opens one case rather than duplicates.

Issue classes:

- `PAID_TOTAL_MISMATCH` — paid normalized amount differs from invoice total;
- `MISSING_PAID_WEBHOOK` — provider inquiry says paid but invoice is not paid;
- `ACTIVATION_WITHOUT_PAID_INVOICE` — access exists without a paid/refunded invoice state;
- `MATCHED` — current internal/provider evidence agrees.

Cases use `MATCHED`, `MISMATCH`, `MISSING_PROVIDER_EVENT`, `DUPLICATE_EVENT`, `INCORRECT_ACTIVATION`, `MANUAL_REVIEW`, or `RESOLVED`. Reconciliation never silently edits financial history. An authorized finance operator reviews evidence and uses a separately audited retry/correction workflow. Direct SQL fixes are prohibited outside an approved incident/recovery procedure.

The local mock inquiry reads the mock ledger and proves workflow shape only. Production scheduling, provider settlement files, bank settlement comparison, alert thresholds, case ownership, SLA, and safe automated retry remain blocked pending provider/finance decisions.
