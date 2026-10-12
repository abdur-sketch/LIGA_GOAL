import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma, type OrganizerType } from "@prisma/client";
import { ApiError, authorizeOrganization, type getApiActor } from "@/lib/auth/api";
import { getEffectivePermissions, type PermissionKey } from "@/lib/auth/permissions";
import { db, rootDb } from "@/lib/db";
import {
  withIdentityDatabase,
  withInvitationDatabase,
  withProvisioningDatabase,
  withTenantDatabase,
} from "@/lib/tenant-db";
import { ownerPermissionKeys } from "@/modules/phase1/service";
import { commitQuotaInCurrentTransaction, reserveQuotaInCurrentTransaction } from "@/modules/phase14/service";
import {
  invitationActionSchema,
  invitationSchema,
  onboardingSchema,
  registrationSchema,
  resendVerificationSchema,
  verificationSchema,
  type OnboardingInput,
} from "./validation";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
type RequestContext = { requestId?: string; ip?: string; userAgent?: string };

export const CURRENT_TERMS_VERSION = "2026-10-12";
export const CURRENT_PRIVACY_VERSION = "2026-10-12";
export const VERIFICATION_TTL_MS = 30 * 60_000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;

const invitationPermission: PermissionKey = "organization.invitation.manage";
const managerPermissions: PermissionKey[] = [
  "organization.view", "organization.update", "organization.manage_members",
  invitationPermission, "competition.view", "competition.create", "competition.update",
  "season.view", "season.create", "season.update", "club.view", "club.create",
  "club.update", "venue.view", "venue.create", "venue.update", "official.view",
  "official.create", "official.update", "fixture.view", "fixture.create", "fixture.update",
  "schedule.view", "schedule.manage", "match.view", "standings.view", "statistics.view",
];
const editorPermissions: PermissionKey[] = [
  "organization.view", "competition.view", "competition.update", "season.view",
  "season.update", "club.view", "club.create", "club.update", "venue.view",
  "official.view", "fixture.view", "fixture.update", "schedule.view", "match.view",
  "standings.view", "statistics.view",
];
const viewerPermissions: PermissionKey[] = [
  "organization.view", "competition.view", "season.view", "club.view", "venue.view",
  "official.view", "fixture.view", "schedule.view", "match.view", "standings.view",
  "statistics.view",
];

export function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function opaqueContext(value?: string) {
  return value ? createHash("sha256").update(value).digest("hex") : undefined;
}

function issueToken() {
  return randomBytes(32).toString("base64url");
}

async function identityAudit(actorId: string, action: "CREATE" | "APPROVE" | "UPDATE", resourceType: string) {
  await db.auditLog.createMany({ data: [{ actorId, action, resourceType, resourceId: actorId }] });
}

async function rotateVerificationToken(userId: string) {
  const now = new Date();
  const token = issueToken();
  await db.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });
  await db.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: tokenDigest(token),
      expiresAt: new Date(now.valueOf() + VERIFICATION_TTL_MS),
      resendAllowedAt: new Date(now.valueOf() + VERIFICATION_RESEND_COOLDOWN_MS),
    },
  });
  return token;
}

export async function registerOrganizer(raw: unknown) {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "Data pendaftaran tidak valid.", parsed.error.flatten());
  if (parsed.data.website || (parsed.data.startedAt && Date.now() - parsed.data.startedAt < 800)) {
    return { email: parsed.data.email, token: null };
  }
  const passwordHash = await hash(parsed.data.password, 12);
  return withIdentityDatabase(async () => {
    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing?.emailVerifiedAt || existing?.isActive || existing?.deletedAt) {
      return { email: parsed.data.email, token: null };
    }
    if (existing) {
      const latest = await db.emailVerificationToken.findFirst({
        where: { userId: existing.id, usedAt: null }, orderBy: { createdAt: "desc" },
      });
      if (latest?.resendAllowedAt && latest.resendAllowedAt > new Date()) {
        return { email: parsed.data.email, token: null };
      }
      await db.user.update({ where: { id: existing.id }, data: { name: parsed.data.name, passwordHash } });
      return { email: parsed.data.email, token: await rotateVerificationToken(existing.id) };
    }
    try {
      const user = await db.user.create({
        data: { name: parsed.data.name, email: parsed.data.email, passwordHash, isActive: false },
      });
      const token = await rotateVerificationToken(user.id);
      await identityAudit(user.id, "CREATE", "SELF_SERVICE_REGISTRATION");
      return { email: parsed.data.email, token };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { email: parsed.data.email, token: null };
      }
      throw error;
    }
  });
}

export async function resendVerification(raw: unknown) {
  const parsed = resendVerificationSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "Data tidak valid.");
  return withIdentityDatabase(async () => {
    const user = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.deletedAt || user.emailVerifiedAt || user.isActive) return { email: parsed.data.email, token: null };
    const latest = await db.emailVerificationToken.findFirst({
      where: { userId: user.id, usedAt: null }, orderBy: { createdAt: "desc" },
    });
    if (latest?.resendAllowedAt && latest.resendAllowedAt > new Date()) return { email: parsed.data.email, token: null };
    const token = await rotateVerificationToken(user.id);
    await identityAudit(user.id, "UPDATE", "EMAIL_VERIFICATION_RESEND");
    return { email: parsed.data.email, token };
  });
}

export async function verifyEmail(raw: unknown) {
  const parsed = verificationSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
  return withIdentityDatabase(async () => {
    const now = new Date();
    const record = await db.emailVerificationToken.findUnique({ where: { tokenHash: tokenDigest(parsed.data.token) } });
    if (!record) throw new ApiError(400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
    const claimed = await db.emailVerificationToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) throw new ApiError(400, "Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
    await db.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: now, isActive: true } });
    await db.emailVerificationToken.updateMany({
      where: { userId: record.userId, usedAt: null }, data: { usedAt: now },
    });
    await identityAudit(record.userId, "APPROVE", "EMAIL_VERIFICATION");
    return { verified: true };
  });
}

async function ensurePermissions(keys: PermissionKey[]) {
  const rows = [];
  for (const key of keys) {
    rows.push(await db.permission.upsert({
      where: { key }, update: {}, create: { key, description: key.replaceAll(".", " ") },
      select: { id: true, key: true },
    }));
  }
  return rows;
}

async function createRole(organizationId: string, name: string, key: string, permissionKeys: PermissionKey[]) {
  const permissions = await ensurePermissions(permissionKeys);
  return db.role.create({
    data: {
      organizationId, name, key, isSystem: true,
      permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
    },
  });
}

export async function provisionOrganization(actor: Actor, raw: unknown, context: RequestContext = {}) {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "Data onboarding tidak valid.", parsed.error.flatten());
  if (parsed.data.termsVersion !== CURRENT_TERMS_VERSION || parsed.data.privacyVersion !== CURRENT_PRIVACY_VERSION) {
    throw new ApiError(409, "Versi persetujuan telah berubah. Muat ulang formulir.");
  }
  return withProvisioningDatabase(actor.id, async () => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase13:${actor.id}`}))`;
    const identity = await db.user.findUnique({ where: { id: actor.id }, select: { isActive: true, emailVerifiedAt: true, deletedAt: true } });
    if (!identity?.isActive || !identity.emailVerifiedAt || identity.deletedAt) throw new ApiError(403, "Verifikasi email diperlukan.");
    const existing = await db.organizerOnboarding.findUnique({ where: { userId: actor.id }, include: { organization: true } });
    if (existing) {
      if (existing.idempotencyKey !== parsed.data.idempotencyKey) throw new ApiError(409, "Akun ini sudah memiliki organisasi.");
      return existing.organization;
    }
    try {
      const organization = await db.organization.create({
        data: {
          name: parsed.data.organizationName, slug: parsed.data.slug, status: "ACTIVE",
          logoUrl: parsed.data.logoUrl || null, contactEmail: parsed.data.contactEmail,
          contactPhone: parsed.data.contactPhone || null, address: parsed.data.address || null, ownerId: actor.id,
        },
      });
      const freePlan = await db.planVersion.findFirstOrThrow({ where: { plan: { code: "FREE" }, version: 1, isActive: true }, select: { id: true } });
      await db.organizationSubscription.create({ data: { organizationId: organization.id, planVersionId: freePlan.id, status: "ACTIVE", reason: "SELF_SERVICE_FREE_PROVISIONING" } });
      const ownerRole = await createRole(organization.id, "Organization Owner", "organization-owner", [...new Set([...ownerPermissionKeys, invitationPermission])]);
      await createRole(organization.id, "Organizer Manager", "organizer-manager", managerPermissions);
      await createRole(organization.id, "Competition Editor", "competition-editor", editorPermissions);
      await createRole(organization.id, "Viewer", "viewer", viewerPermissions);
      await db.organizationMember.create({ data: { organizationId: organization.id, userId: actor.id, roleId: ownerRole.id } });
      await db.organizerOnboarding.create({
        data: { organizationId: organization.id, userId: actor.id, idempotencyKey: parsed.data.idempotencyKey, organizerType: parsed.data.organizerType as OrganizerType, region: parsed.data.region, status: "COMPLETED", completedAt: new Date() },
      });
      await db.organizationConsentRecord.create({
        data: {
          organizationId: organization.id, userId: actor.id,
          termsVersion: parsed.data.termsVersion, privacyVersion: parsed.data.privacyVersion,
          requestId: context.requestId, ipHash: opaqueContext(context.ip), userAgentHash: opaqueContext(context.userAgent),
        },
      });
      await db.auditLog.createMany({ data: [{ organizationId: organization.id, actorId: actor.id, action: "CREATE", resourceType: "SELF_SERVICE_ORGANIZATION", resourceId: organization.id }] });
      return organization;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replay = await db.organizerOnboarding.findUnique({ where: { userId: actor.id }, include: { organization: true } });
        if (replay?.idempotencyKey === parsed.data.idempotencyKey) return replay.organization;
        throw new ApiError(409, "Slug organisasi sudah digunakan atau organisasi telah dibuat.");
      }
      throw error;
    }
  });
}

export async function organizerOverview(actor: Actor) {
  const memberships = await import("@/lib/tenant-db").then(({ withMembershipDatabase }) =>
    withMembershipDatabase(actor.id, () => db.organizationMember.findMany({
      where: { userId: actor.id, isActive: true },
      select: { organization: { select: { id: true, name: true, slug: true, status: true } } },
    })),
  );
  if (!memberships[0]) return null;
  const organization = memberships[0].organization;
  return withTenantDatabase(rootDb, organization.id, async () => ({
    organization,
    competitions: await db.competition.findMany({ where: { organizationId: organization.id, deletedAt: null }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" } }),
    members: await db.organizationMember.findMany({ where: { organizationId: organization.id }, select: { id: true, isActive: true, user: { select: { name: true, email: true } }, role: { select: { name: true, key: true } } }, orderBy: { createdAt: "asc" } }),
    invitations: await db.organizationInvitation.findMany({ where: { organizationId: organization.id }, select: { id: true, email: true, status: true, expiresAt: true, role: { select: { name: true } } }, orderBy: { createdAt: "desc" } }),
    roles: await db.role.findMany({ where: { organizationId: organization.id, key: { not: "organization-owner" } }, select: { id: true, name: true, key: true } }),
  }));
}

export async function createInvitation(actor: Actor, organizationId: string, raw: unknown) {
  const parsed = invitationSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(422, "Data undangan tidak valid.");
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, invitationPermission);
    const role = await db.role.findFirst({ where: { id: parsed.data.roleId, organizationId }, include: { permissions: { select: { permission: { select: { key: true } } } } } });
    if (!role || role.key === "organization-owner") throw new ApiError(403, "Role undangan tidak diizinkan.");
    if (!actor.isPlatformAdmin) {
      const inviterPermissions = await getEffectivePermissions(actor.id, organizationId);
      if (role.permissions.some((link) => !inviterPermissions.has(link.permission.key))) throw new ApiError(403, "Role melebihi izin pengundang.");
    }
    const currentMember = await db.organizationMember.findFirst({ where: { organizationId, user: { email: parsed.data.email }, isActive: true } });
    if (currentMember) throw new ApiError(409, "Email tersebut sudah menjadi anggota.");
    await db.organizationInvitation.updateMany({ where: { organizationId, email: parsed.data.email, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
    const token = issueToken();
    const invitation = await db.organizationInvitation.create({ data: { organizationId, email: parsed.data.email, roleId: role.id, invitedById: actor.id, tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS) } });
    await db.auditLog.createMany({ data: [{ organizationId, actorId: actor.id, action: "CREATE", resourceType: "ORGANIZATION_INVITATION", resourceId: invitation.id }] });
    return { invitation, token };
  });
}

export async function revokeInvitation(actor: Actor, organizationId: string, invitationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, invitationPermission);
    const result = await db.organizationInvitation.updateMany({ where: { id: invitationId, organizationId, status: "PENDING" }, data: { status: "REVOKED", revokedAt: new Date() } });
    if (result.count !== 1) throw new ApiError(404, "Undangan aktif tidak ditemukan.");
    await db.auditLog.createMany({ data: [{ organizationId, actorId: actor.id, action: "DELETE", resourceType: "ORGANIZATION_INVITATION", resourceId: invitationId }] });
  });
}

export async function resendInvitation(actor: Actor, organizationId: string, invitationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, invitationPermission);
    const invitation = await db.organizationInvitation.findFirst({ where: { id: invitationId, organizationId, status: "PENDING" } });
    if (!invitation) throw new ApiError(404, "Undangan aktif tidak ditemukan.");
    if (Date.now() - invitation.lastSentAt.valueOf() < VERIFICATION_RESEND_COOLDOWN_MS) throw new ApiError(429, "Tunggu sebelum mengirim ulang undangan.");
    const token = issueToken();
    await db.organizationInvitation.update({ where: { id: invitation.id }, data: { tokenHash: tokenDigest(token), expiresAt: new Date(Date.now() + INVITATION_TTL_MS), lastSentAt: new Date() } });
    await db.auditLog.createMany({ data: [{ organizationId, actorId: actor.id, action: "UPDATE", resourceType: "ORGANIZATION_INVITATION_RESEND", resourceId: invitation.id }] });
    return { email: invitation.email, token };
  });
}

async function discoverInvitation(actor: Actor, token: string) {
  const hashValue = tokenDigest(token);
  const invitation = await withInvitationDatabase(actor.id, hashValue, () => db.organizationInvitation.findUnique({ where: { tokenHash: hashValue } }));
  if (!invitation) throw new ApiError(400, "Undangan tidak valid atau sudah kedaluwarsa.");
  return invitation;
}

export async function respondToInvitation(actor: Actor, raw: unknown, action: "accept" | "decline") {
  const parsed = invitationActionSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, "Undangan tidak valid atau sudah kedaluwarsa.");
  const discovered = await discoverInvitation(actor, parsed.data.token);
  return withTenantDatabase(rootDb, discovered.organizationId, async () => {
    const identity = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, emailVerifiedAt: true, isActive: true } });
    const invitation = await db.organizationInvitation.findFirst({ where: { id: discovered.id, organizationId: discovered.organizationId, tokenHash: tokenDigest(parsed.data.token), status: "PENDING", expiresAt: { gt: new Date() } } });
    if (!identity?.isActive || !identity.emailVerifiedAt || !invitation || identity.email.toLowerCase() !== invitation.email.toLowerCase()) throw new ApiError(400, "Undangan tidak valid atau sudah kedaluwarsa.");
    if (action === "decline") {
      const claimed = await db.organizationInvitation.updateMany({ where: { id: invitation.id, status: "PENDING" }, data: { status: "DECLINED", declinedAt: new Date() } });
      if (claimed.count !== 1) throw new ApiError(409, "Undangan sudah digunakan.");
      await db.auditLog.createMany({ data: [{ organizationId: invitation.organizationId, actorId: actor.id, action: "REJECT", resourceType: "ORGANIZATION_INVITATION", resourceId: invitation.id }] });
      return { status: "DECLINED" as const };
    }
    const role = await db.role.findFirst({ where: { id: invitation.roleId, organizationId: invitation.organizationId, key: { not: "organization-owner" } } });
    if (!role) throw new ApiError(403, "Role undangan tidak diizinkan.");
    const quotaKey = `invite:${invitation.id}`;
    const quota = await reserveQuotaInCurrentTransaction({ organizationId: invitation.organizationId, metricKey: "member.active", featureKey: "member.max_active", eventKey: quotaKey, currentUsage: () => db.organizationMember.count({ where: { organizationId: invitation.organizationId, isActive: true } }) });
    if (quota.duplicate) throw new ApiError(409, "Undangan sudah digunakan.");
    const claimed = await db.organizationInvitation.updateMany({ where: { id: invitation.id, status: "PENDING" }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: actor.id } });
    if (claimed.count !== 1) throw new ApiError(409, "Undangan sudah digunakan.");
    await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: actor.id } }, update: { roleId: role.id, isActive: true }, create: { organizationId: invitation.organizationId, userId: actor.id, roleId: role.id } });
    await commitQuotaInCurrentTransaction({ organizationId: invitation.organizationId, counterId: quota.counterId, metricKey: "member.active", eventKey: quotaKey, resourceId: actor.id });
    await db.auditLog.createMany({ data: [{ organizationId: invitation.organizationId, actorId: actor.id, action: "APPROVE", resourceType: "ORGANIZATION_INVITATION", resourceId: invitation.id }] });
    return { status: "ACCEPTED" as const, organizationId: invitation.organizationId };
  });
}

export function onboardingDefaults(): Pick<OnboardingInput, "termsVersion" | "privacyVersion"> {
  return { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION };
}
