# Human UAT Execution Pack

Status: **FIXTURES READY LOCALLY — HUMAN EXECUTION NOT STARTED**

## Environment

- Database: `portal_lomba_phase23_human_uat` (loopback only).
- Migration: 35/35 final.
- Organization: `phase23-human-uat`.
- Data: synthetic only; eight templates, two seed participants/entries, one session, public registration quota 50, judge assignment.
- Password is supplied through `PHASE23_UAT_PASSWORD` and is not stored in Git or this document.

Start locally using explicit test safety variables and the UAT database. Do not expose the server to a public network and do not reuse these accounts in staging/production.

## Accounts

| Role | Email | Primary responsibility |
| --- | --- | --- |
| Platform admin | `phase23-admin@portal-lomba.test` | Readiness/status observation |
| Organizer | `phase23-organizer@portal-lomba.test` | Competition/session/assignment management |
| Verifier | `phase23-verifier@portal-lomba.test` | Registration review/revision/approve/reject |
| Judge | `phase23-judge@portal-lomba.test` | Assigned-session scoring only |
| Reviewer | `phase23-reviewer@portal-lomba.test` | Review submitted result |
| Approver | `phase23-approver@portal-lomba.test` | Approve/publish/reopen with audit |
| Viewer | `phase23-viewer@portal-lomba.test` | Authorized read-only negative test |
| Participant/public | No login | Public registration/status/result access |

## Template scenarios

Apply this flow to Sepak Bola, LCT, Sekolah, Seni, Keagamaan, Gebyar/Festival, E-Sports, and Custom:

1. Participant opens the public slug and submits a unique synthetic registration with valid consent; for a minor scenario, supply guardian data and consent.
2. Verifier checks the queue, requests one revision, approves one registration, and confirms no contact/document data appears publicly.
3. Organizer confirms participant/entry creation and assigns the judge only to the intended session.
4. Viewer attempts scoring and must be denied. Judge scores only assigned entries; duplicate idempotency replay must not create a second score.
5. Organizer submits results. Organizer/self actor must be denied review/approval.
6. Reviewer reviews; Approver approves; score/result becomes locked.
7. Approver publishes; public user sees only published result. Draft/raw score/PII must remain hidden.
8. Reopen with a required reason; verify audit history and repeat approval before republishing.

Festival additionally verifies multiple branches and cross-branch isolation. Custom verifies custom form/rubric labels. Football additionally verifies legacy navigation and match/statistics regression.

## Sign-off form — repeat for every template

| Field | Human input |
| --- | --- |
| Template / build SHA | |
| Tester name and role | |
| Date/time and environment | |
| Steps executed | |
| Expected result | |
| Actual result | |
| Evidence link/reference | |
| Defect IDs/severity | |
| PASS / FAIL / BLOCKED | |
| Tester sign-off | |
| Release owner sign-off | |

Automation and seeded fixtures do not fill actual result or sign-off. Pilot remains **NO-GO** until all eight forms are complete and high-severity defects are closed.
