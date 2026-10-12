# Public Organizer Profiles

## Published fields

Only these profile fields may be returned publicly: public slug, display name, description, logo URL, website URL, explicitly entered public contact email/phone, published timestamps, selected province/city, and count/list of published competitions.

The following are never implicitly published: Organization contactEmail/contactPhone/address, owner ID, member names/emails, invitation data, billing/tax data, consent context, user email/password/session data, audit data, or internal IDs not required by the DTO.

## Lifecycle

| State | Public | Organizer action | Moderator action |
|---|---|---|---|
| DRAFT | no | edit, submit | none |
| PENDING_REVIEW | no | edit/resubmit, withdraw | publish/unpublish/suspend |
| PUBLISHED | yes | withdraw; edit returns to review | unpublish/suspend |
| UNPUBLISHED | no | edit, resubmit | publish/suspend |
| SUSPENDED | no | cannot restore | publish/unpublish after review |

## Authorization

- Tenant: `organization.public_profile.manage`.
- Competition projection: `competition.publication.manage`.
- Platform queue: `discovery.moderate.view`.
- Platform decision: `discovery.moderate.manage`.

Platform status alone does not grant discovery moderation. Cross-tenant ownership is checked at the DAL and protected again by RLS.

## Moderation checklist

- Identity/name is not misleading.
- Logo and description ownership is plausible and free of prohibited content.
- Website/contact was intentionally submitted for public display.
- Region matches organizer operation.
- No personal/private information appears in free text.
- Competition status and organizer status are both eligible.
- Decision reason is specific enough for audit and appeal.

## Operations not yet implemented

Abuse report intake, appeal workflow, automated image/text scanning, legal takedown queue, verified badges, moderator assignment/SLA, and bulk audit export. These are P0/P1 dependencies for national self-service, not reasons to expose drafts early.
