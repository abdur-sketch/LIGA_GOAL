import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, authorizeOrganization, type getApiActor } from "@/lib/auth/api";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
const grantSchema = z.object({ organizationId: z.string().min(1).max(64), playerId: z.string().min(1).max(64), scope: z.literal("PUBLIC_PROFILE").default("PUBLIC_PROFILE"), legalBasis: z.string().trim().min(3).max(120), guardianConfirmed: z.boolean().default(false), evidenceReference: z.string().trim().min(8).max(500), expiresAt: z.coerce.date().optional() });
const withdrawSchema = z.object({ organizationId: z.string().min(1).max(64), reason: z.string().trim().min(3).max(500) });

export async function grantPublicationConsent(actor: Actor, raw: unknown) {
  const input = grantSchema.parse(raw); await authorizeOrganization(actor, input.organizationId, "player.update");
  const player = await db.player.findFirst({ where: { id: input.playerId, organizationId: input.organizationId, deletedAt: null }, select: { id: true, dateOfBirth: true } });
  if (!player) throw new ApiError(404, "Pemain tidak ditemukan.");
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18); const isMinor = Boolean(player.dateOfBirth && player.dateOfBirth > cutoff);
  if (isMinor && !input.guardianConfirmed) throw new ApiError(422, "Konfirmasi wali wajib untuk pemain anak.");
  if (input.expiresAt && input.expiresAt <= new Date()) throw new ApiError(422, "Masa berlaku consent harus di masa depan.");
  const evidenceHash = createHash("sha256").update(input.evidenceReference).digest("hex");
  return db.$transaction(async (tx) => {
    await tx.publicationConsent.updateMany({ where: { organizationId: input.organizationId, playerId: input.playerId, scope: input.scope, withdrawnAt: null }, data: { withdrawnAt: new Date(), withdrawalReason: "Superseded" } });
    const consent = await tx.publicationConsent.create({ data: { organizationId: input.organizationId, playerId: input.playerId, scope: input.scope, legalBasis: input.legalBasis, isMinor, guardianConfirmed: input.guardianConfirmed, evidenceHash, expiresAt: input.expiresAt, grantedById: actor.id } });
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "APPROVE", resourceType: "PublicationConsent", resourceId: consent.id, after: { playerId: input.playerId, scope: input.scope, isMinor, expiresAt: input.expiresAt } } });
    return consent;
  });
}

export async function withdrawPublicationConsent(actor: Actor, id: string, raw: unknown) {
  const input = withdrawSchema.parse(raw); await authorizeOrganization(actor, input.organizationId, "player.update");
  return db.$transaction(async (tx) => {
    const consent = await tx.publicationConsent.findFirst({ where: { id, organizationId: input.organizationId, withdrawnAt: null } });
    if (!consent) throw new ApiError(404, "Consent aktif tidak ditemukan.");
    const updated = await tx.publicationConsent.update({ where: { id }, data: { withdrawnAt: new Date(), withdrawalReason: input.reason } });
    await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "UPDATE", resourceType: "PublicationConsent", resourceId: id, before: { withdrawnAt: null }, after: { withdrawnAt: updated.withdrawnAt, reason: input.reason } } });
    return updated;
  });
}

export function activePublicConsentWhere(now = new Date()): Prisma.PublicationConsentListRelationFilter {
  return { some: { scope: "PUBLIC_PROFILE", withdrawnAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } };
}
