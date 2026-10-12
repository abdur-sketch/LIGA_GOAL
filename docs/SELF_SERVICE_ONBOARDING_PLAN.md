# LIGA GOAL — Self-Service Organizer Onboarding Plan

PROJECT: LIGA GOAL
PHASE: 12
DATE: 2026-10-12
STATUS: Design only; self-service is not enabled

## 1. Goal and non-goals

Enable a verified organizer to create a safely isolated organization and progress through:

**Register → Verify → Create Organization → Create Competition → Configure Season → Invite Staff → Register Clubs → Publish Competition**

This plan does not enable anonymous tenant creation, live payment, automatic production activation or removal of existing RBAC/RLS controls.

## 2. Baseline gap

The current application supports credential login, recovery, session revocation, platform-admin organization creation, tenant membership/RBAC and the full competition workflow. It does not currently support public account registration, email verification, invitation issuance/acceptance or non-admin organization provisioning. Organization creation is explicitly restricted to platform admins. Those restrictions stay in place until the complete self-service gate is implemented and tested.

## 3. End-to-end state machine

| Step | Required state | Transaction/output | Failure and recovery |
|---|---|---|---|
| Register | Valid normalized email; password policy; risk checks pass | Create inactive/unverified identity and verification challenge; generic response | Rate-limit; reuse safe pending identity; never reveal whether an active account exists. |
| Verify | Hashed single-use token, unexpired, attempt limit | Mark email verified; revoke sibling tokens; audit | Allow resend with cooldown; expired token cannot provision. |
| Create Organization | Verified active user; terms accepted; owner quota and risk checks pass | Idempotently create `PENDING` organization, owner role/grants and membership | Transaction rollback leaves no partial tenant; retry same key returns same result. |
| Organization review | Automated checks and, for risk triggers, platform review | `PENDING → ACTIVE` or rejected/held outcome | No competition publication while pending. |
| Create Competition | Active organization; `competition.create`; entitlement and quota available | Existing competition service creates tenant-scoped draft | Quota denial returns upgrade/request-review path without partial record. |
| Configure Season | Competition belongs to selected tenant; permission/entitlement | Existing season/stage/rule services | Invalid dates/format rejected through existing validation. |
| Invite Staff | `organization.invitation.manage`; seat available | Create expiring invitation for role/email | Do not create membership until acceptance; reissue/revoke safely. |
| Register Clubs | Existing club/participation permissions and limits | Existing club and participation services | Duplicate/foreign-tenant relations rejected. |
| Publish Competition | Checklist passes; publish permission; plan active | Atomic publication timestamp/state and audit/outbox | No partial public visibility; rollback to draft before public reads. |

## 4. Provisioning transaction

Input must contain only verified identity, organization name, requested slug, country and accepted policy versions. It must not accept owner ID, role ID, plan privilege or platform state from the browser.

Within one transaction:

1. lock or create a unique provisioning request by idempotency key;
2. re-read verified active user;
3. check user-level organization creation quota and abuse status;
4. reserve globally unique normalized slug;
5. create `Organization(PENDING, ownerId=user.id)`;
6. create the existing organization-owner role;
7. link the approved existing permission catalog;
8. create active owner membership;
9. assign the Free plan/subscription record with catalog version;
10. append audit and outbox events;
11. complete provisioning request with organization ID.

No external email, analytics or provider call occurs inside the database transaction. Consumers process the outbox after commit.

## 5. Permission model

### Tenant roles

| Role | Typical scope | Excluded by default |
|---|---|---|
| Organization Owner | Tenant settings, membership, competition and subscription management | Platform administration; destructive billing adjustments |
| Competition Admin | Competition/season/club/fixture/statistics administration | Tenant ownership, billing, platform access |
| Registrar | Player, document and squad workflows | Match approval and billing |
| Match Operator | Lineup, live event and match lifecycle | Registration approval and tenant settings |
| Content Editor | Article/notification/public content | Private medical/identity documents |
| Finance Viewer | Subscription, invoice and usage read-only | Domain mutation and payment-method mutation |
| Read-only Analyst | Approved tenant reporting/statistics | Export of private data unless separately granted |

The existing deny override continues to win. Invitations reference a role inside the same organization. An inviter cannot assign a role containing permissions they cannot manage. Owner transfer, last-owner removal and high-risk grant changes require reauthentication and audit.

### Publication gate

Publishing requires all of the following:

- active organization and verified owner;
- competition, active season, format/rules and at least the configured minimum clubs;
- no unresolved plan/quota violation;
- public contact and organizer profile fields approved for publication;
- privacy/consent checks for any player data;
- publication permission and immutable audit entry.

## 6. Abuse prevention

- Per-IP, per-email, per-device-risk and global signup/verification/provisioning rate limits.
- Email normalization, disposable-domain policy, breached-password screening decision and CAPTCHA/risk challenge only after suspicious behavior.
- One active verification challenge family per identity; hashed token, short expiry, resend cooldown and bounded attempts.
- Limit pending organizations per identity and apply a cooling period after repeated rejected provisioning.
- Slug reservation and profanity/brand-abuse review.
- Invitations use normalized email, hashed single-use token, expiry, revocation and tenant-bound role.
- New organizations begin `PENDING`; risky cases require platform review before `ACTIVE`.
- Free-plan limits cap resource and notification abuse. Public mutation endpoints receive dedicated rate buckets.
- Uploads remain signature-checked, quarantined and scanned before use; publication never exposes quarantine/private objects.
- Record reason-coded risk decisions without retaining unnecessary fingerprinting data.

## 7. Quota enforcement by onboarding step

| Operation | Example meter | Behavior at limit |
|---|---|---|
| Create organization | active organizations owned by user | Deny; explain plan/policy; no partial tenant. |
| Invite/activate staff | active tenant members + pending seat reservations | Reserve seat for accepted invitation only, or expire reservation predictably. |
| Create competition | active/draft competitions under policy | Deny before insert; offer archive or plan change. |
| Register club/player | active season entities | Atomic check/reservation in tenant transaction. |
| Start live match | concurrent live-match lease | Deny transition before match enters live state. |
| Upload | accepted bytes and object count | Reject before upload when possible; reconcile final scanned size. |
| Export/notification | period ledger | Idempotent event usage; retry never double-charges quota. |

Quota failures use stable codes such as `PLAN_FEATURE_DISABLED`, `LIMIT_REACHED`, `SUBSCRIPTION_GRACE_READ_ONLY` and `ORGANIZATION_SUSPENDED`. Do not infer a billing failure when the real cause is RBAC or validation.

## 8. Lifecycle and suspension

### User

`PENDING_VERIFICATION → ACTIVE → LOCKED/SUSPENDED → DEACTIVATED → ANONYMIZED/DELETED` according to approved policy. The existing `isActive`, `deletedAt` and `sessionVersion` can enforce access, but explicit verification and lifecycle state will likely be additive.

### Invitation

`PENDING → ACCEPTED | EXPIRED | REVOKED`. Acceptance is idempotent and must match the signed-in normalized email unless an approved account-linking flow exists.

### Organization

- `PENDING`: onboarding/review only; no public publication.
- `ACTIVE`: normal access subject to plan and RBAC.
- `SUSPENDED`: public pages follow owner-approved policy; tenant mutations denied except support, export/appeal and billing resolution endpoints explicitly allowed.
- `ARCHIVED`: read-only retention state; no active subscription consumption except retained storage policy.

Suspension must capture reason category, actor, effective time, review/appeal route and communication status. A platform operator must not silently edit tenant domain data as part of suspension.

### Subscription

`INCOMPLETE/TRIALING → ACTIVE → PAST_DUE → GRACE → PAUSED/CANCELED → EXPIRED`, with provider events mapped through reviewed transitions. Free organizations remain valid without a payment object.

## 9. Data retention and exit

Proposed policy requires legal/owner approval before implementation:

- unverified signup/token: 7–30 days;
- expired invitations: 90 days, with token material removed earlier;
- operational audit: minimum 12 months; financial evidence according to Indonesian tax/accounting advice;
- private identity, medical and minor data: purpose-specific schedule, not “retain forever”;
- canceled tenant: 30-day grace read/export, then archived retention, then deletion/anonymization workflow;
- backups expire through documented retention; deletions propagate after backup retention rather than mutating immutable backups;
- legal hold supersedes normal deletion only with documented authority.

Provide organization export before destructive deletion. Shared/public historical sports results may be retained only under an approved legal/publication basis and must be separated from private identity/document records.

## 10. Security test plan

Mandatory automated scenarios:

1. unverified identity cannot provision;
2. duplicate provisioning idempotency creates one tenant only;
3. tenant A invitation/role cannot be accepted into tenant B;
4. inviter cannot grant a role above their authority;
5. cross-tenant IDs fail at application and RLS layers;
6. suspended user and organization lose active sessions/mutations;
7. plan downgrade cannot leave unbounded new writes;
8. quota race creates no more than the allowed count;
9. expired/replayed verification and invitation tokens fail;
10. public publication excludes draft/private/minor-without-consent data;
11. webhook replay cannot duplicate subscription access;
12. pool reuse never leaks tenant, identity, membership, job or public context.

## 11. Delivery slices and estimates

| Slice | Scope | Estimate | Exit gate |
|---|---|---:|---|
| SS-1 | Registration, verification, terms evidence, abuse controls | 2–3 engineer-weeks | Negative auth tests and email sandbox pass |
| SS-2 | Idempotent provisioning and Free-plan assignment | 2–3 engineer-weeks | Tenant A/B RLS and rollback tests pass |
| SS-3 | Invitation lifecycle and role guardrails | 2–3 engineer-weeks | Privilege-escalation suite passes |
| SS-4 | Entitlement/quota checks through publish flow | 3–4 engineer-weeks | Concurrency and downgrade tests pass |
| SS-5 | Suspension, appeal/export and retention jobs | 2–3 engineer-weeks | Lifecycle UAT and legal policy approval |
| SS-6 | Guided onboarding UI/checklist/analytics | 2–3 engineer-weeks | Funnel UAT and accessibility pass |

Total: 13–19 engineer-weeks; several slices overlap with the SaaS control-plane work and must not be double-counted in portfolio estimates.

## 12. Owner decisions required

1. Is every verified account eligible to create one Free organization, or is organizer review mandatory?
2. What evidence is required to activate an organizer and publish nationally?
3. Which staff roles and separation-of-duty rules are commercial defaults?
4. What are suspension appeal, grace, export and deletion timelines?
5. Which identity/email/risk providers may be evaluated in staging?
6. Are organizer terms, privacy notice, minors policy and data retention approved?

## 13. Readiness statement

The existing admin-created tenant flow remains the only authorized provisioning path. Self-service must remain disabled until all P0 slices, RLS/RBAC tests, abuse controls and staging UAT pass. Production remains **NO-GO**.
