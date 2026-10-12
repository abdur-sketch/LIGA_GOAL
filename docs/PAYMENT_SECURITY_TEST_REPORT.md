# Payment Security Test Report — Phase 15

Local evidence dated 12 October 2026:

| Scenario | Result |
|---|---|
| Exact raw-body signature / tampered bytes | PASS |
| Invalid signature | PASS — rejected before financial lookup/mutation |
| Amount/currency mismatch | PASS — rejected and audited |
| Webhook replay | PASS — duplicate acknowledged, no repeated effect |
| Concurrent same-key checkout | PASS — one order/invoice |
| Client price tampering | PASS — catalog amount used |
| Plan/competition tenant validation | PASS |
| Expired payment | PASS — no activation; existing Free access unchanged |
| Paid then late failed event | PASS — ignored, no regression |
| Subscription activation replay | PASS — one activation/transaction |
| Tournament scoped activation | PASS — only purchased competition |
| Cross-tenant invoice access | PASS |
| Runtime role default deny | PASS |
| Unauthorized/cross-tenant refund | PASS — denied before transaction lookup |
| Partial refund | PASS — scoped access retained until fully refunded |
| Full refund replay | PASS — one refund result/credit note |
| Provider outage | PASS — retry exhausted, checkout transaction rolled back |
| Issued invoice rewrite | PASS — PostgreSQL trigger rejected mutation |
| Reconciliation case | PASS |

Automated results: 53 unit tests PASS; 67 integration tests PASS with 5 opt-in skips in the standard command; Phase 11 membership-runtime and 25-step UAT opt-ins additionally PASS. Three unresolved opt-ins are external/fixture-bound: concurrent operator fixture `phase11-load-050` and two S3 emulator suites. The full E2E regression passed 42/42 across desktop and mobile, including all Phase 15 billing and finance scenarios.

No card number, CVV, production key, live provider payload, or real payment was stored or processed.
