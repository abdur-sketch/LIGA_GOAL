import { randomUUID } from "node:crypto";
import { Prisma, type TransferStatus } from "@prisma/client";
import { ApiError, authorizeOrganization, capabilities, getApiActor } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { automaticSuspensionSpecs, nextTransferStatus, requiredApprovalSteps, type ApprovalStep } from "./engine";
import {
  appealSchema,
  availabilitySchema,
  clearanceSchema,
  decisionSchema,
  disciplinaryCaseSchema,
  injuryProgressSchema,
  injurySchema,
  suspensionSchema,
  transferActionSchema,
  transferSchema,
  transferWindowSchema,
} from "./validation";

export type Actor = Awaited<ReturnType<typeof getApiActor>>;
export type Query = {
  organizationId: string;
  search: string;
  status?: string;
  competitionId?: string;
  seasonId?: string;
  playerId?: string;
  page: number;
  pageSize: number;
};

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const page = (total: number, query: Query) => ({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) });

async function audit(tx: Prisma.TransactionClient, actor: Actor, organizationId: string, action: "VIEW" | "CREATE" | "UPDATE" | "APPROVE" | "REJECT", resourceType: string, resourceId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId: actor.id, organizationId, action, resourceType, resourceId, before: before == null ? Prisma.JsonNull : json(before), after: after == null ? Prisma.JsonNull : json(after) } });
}

async function validateScope(organizationId: string, competitionId: string, seasonId: string) {
  const season = await db.season.findFirst({ where: { id: seasonId, competitionId, competition: { organizationId, deletedAt: null } } });
  if (!season) throw new ApiError(404, "Kompetisi atau musim tidak ditemukan dalam organisasi.");
  return season;
}

const transferInclude = {
  player: { select: { id: true, fullName: true, displayName: true, photoUrl: true } },
  sourceClub: { select: { id: true, name: true } },
  destinationClub: { select: { id: true, name: true } },
  competition: { select: { id: true, name: true } },
  season: { select: { id: true, name: true } },
  transferWindow: { select: { id: true, name: true, opensAt: true, closesAt: true, status: true } },
  approvals: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" as const } },
  history: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.TransferRequestInclude;

export async function listTransfers(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "transfer.view");
  const where: Prisma.TransferRequestWhereInput = {
    organizationId: query.organizationId,
    ...(query.status ? { status: query.status as TransferStatus } : {}),
    ...(query.seasonId ? { seasonId: query.seasonId } : {}),
    ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}),
  };
  const [data, total, caps] = await Promise.all([
    db.transferRequest.findMany({ where, include: transferInclude, orderBy: { requestedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    db.transferRequest.count({ where }),
    capabilities(actor, query.organizationId, ["transfer.request", "transfer.review", "transfer.approve", "transfer.cancel"]),
  ]);
  return { data, meta: page(total, query), capabilities: caps };
}

export async function getTransfer(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "transfer.view");
  const transfer = await db.transferRequest.findFirst({ where: { id, organizationId }, include: transferInclude });
  if (!transfer) throw new ApiError(404, "Transfer tidak ditemukan.");
  return transfer;
}

export async function createTransfer(actor: Actor, input: unknown) {
  const data = transferSchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "transfer.request");
  await validateScope(data.organizationId, data.competitionId, data.seasonId);
  const existing = await db.transferRequest.findUnique({ where: { organizationId_idempotencyKey: { organizationId: data.organizationId, idempotencyKey: data.idempotencyKey } }, include: transferInclude });
  if (existing) return existing;
  if (data.sourceClubId && data.destinationClubId && data.sourceClubId === data.destinationClubId) throw new ApiError(422, "Klub sumber dan tujuan harus berbeda.");
  const [player, clubs, duplicate] = await Promise.all([
    db.player.findFirst({ where: { id: data.playerId, organizationId: data.organizationId, deletedAt: null } }),
    db.club.count({ where: { id: { in: [data.sourceClubId, data.destinationClubId].filter(Boolean) as string[] }, organizationId: data.organizationId, deletedAt: null } }),
    db.transferRequest.findFirst({ where: { organizationId: data.organizationId, playerId: data.playerId, seasonId: data.seasonId, status: { notIn: ["COMPLETED", "REJECTED", "CANCELLED"] } } }),
  ]);
  if (!player) throw new ApiError(404, "Pemain tidak ditemukan.");
  if (clubs !== new Set([data.sourceClubId, data.destinationClubId].filter(Boolean)).size) throw new ApiError(422, "Klub transfer tidak valid untuk organisasi.");
  if (duplicate) throw new ApiError(409, "Pemain memiliki transfer aktif pada musim yang sama.");
  if (data.sourceClubId && player.activeClubId !== data.sourceClubId) throw new ApiError(422, "Klub sumber tidak sesuai dengan klub aktif pemain.");
  return db.$transaction(async (tx) => {
    const transfer = await tx.transferRequest.create({ data: { ...data, sourceClubId: data.sourceClubId ?? null, destinationClubId: data.destinationClubId ?? null, transferWindowId: data.transferWindowId ?? null, effectiveAt: data.effectiveAt ?? null, supportingDocs: json(data.supportingDocs), createdById: actor.id }, include: transferInclude });
    await tx.transferHistory.create({ data: { organizationId: data.organizationId, transferId: transfer.id, actorId: actor.id, toStatus: "DRAFT", action: "CREATED", snapshot: json({ type: transfer.type, playerId: transfer.playerId, sourceClubId: transfer.sourceClubId, destinationClubId: transfer.destinationClubId }) } });
    await audit(tx, actor, data.organizationId, "CREATE", "TransferRequest", transfer.id, null, { status: transfer.status, playerId: transfer.playerId });
    return transfer;
  });
}

async function transferRules(competitionId: string) {
  const record = await db.competitionRule.findUnique({ where: { competitionId_key: { competitionId, key: "transfer_rules" } } });
  const rules = (record?.value ?? {}) as Record<string, unknown>;
  const configured = Array.isArray(rules.approvalOrder) ? rules.approvalOrder.filter((item): item is ApprovalStep => ["SOURCE_CLUB", "DESTINATION_CLUB", "COMPETITION"].includes(String(item))) : [];
  return { approvalOrder: configured };
}

async function assertWindow(transfer: { organizationId: string; seasonId: string; competitionId: string; transferWindowId: string | null }, override: boolean, reason?: string) {
  const submittedAt = new Date();
  const window = transfer.transferWindowId
    ? await db.transferWindow.findFirst({ where: { id: transfer.transferWindowId, organizationId: transfer.organizationId, seasonId: transfer.seasonId } })
    : await db.transferWindow.findFirst({ where: { organizationId: transfer.organizationId, competitionId: transfer.competitionId, seasonId: transfer.seasonId, status: "OPEN", opensAt: { lte: submittedAt }, closesAt: { gte: submittedAt } } });
  const valid = window && window.status === "OPEN" && window.opensAt <= submittedAt && window.closesAt >= submittedAt && (!window.registrationDeadline || submittedAt <= window.registrationDeadline);
  if (!valid && !(override && reason)) throw new ApiError(422, "Transfer window tertutup. Override resmi dan alasan wajib tersedia.");
  return { window, overridden: !valid };
}

export async function actionTransfer(actor: Actor, organizationId: string, id: string, input: unknown) {
  const data = transferActionSchema.parse(input);
  const permission = data.action === "approve" || data.action === "complete" ? "transfer.approve" : data.action === "cancel" ? "transfer.cancel" : data.action === "submit" ? "transfer.request" : "transfer.review";
  await authorizeOrganization(actor, organizationId, permission);
  const transfer = await db.transferRequest.findFirst({ where: { id, organizationId }, include: { approvals: true } });
  if (!transfer) throw new ApiError(404, "Transfer tidak ditemukan.");
  if (transfer.version !== data.expectedVersion) throw new ApiError(409, "Transfer telah berubah. Muat ulang data terbaru.");
  let next: TransferStatus = transfer.status;
  let approvalStep: "SOURCE_CLUB" | "DESTINATION_CLUB" | "COMPETITION" | "OVERRIDE" | undefined;
  let auditAction: "UPDATE" | "APPROVE" | "REJECT" = "UPDATE";
  if (data.action === "submit") {
    if (transfer.status !== "DRAFT") throw new ApiError(409, "Hanya transfer DRAFT yang dapat diajukan.");
    if (data.overrideWindow) await authorizeOrganization(actor, organizationId, "transfer.approve");
    await assertWindow(transfer, data.overrideWindow, data.reason);
    next = "SUBMITTED";
  } else if (data.action === "review") {
    if (transfer.status !== "SUBMITTED") throw new ApiError(409, "Transfer belum diajukan.");
    next = "UNDER_REVIEW";
  } else if (data.action === "approve") {
    if (!["UNDER_REVIEW", "SOURCE_CLUB_APPROVED", "DESTINATION_CLUB_APPROVED"].includes(transfer.status)) throw new ApiError(409, "Transfer tidak menunggu approval.");
    const rules = await transferRules(transfer.competitionId);
    const steps = requiredApprovalSteps(rules.approvalOrder, transfer.sourceClubId, transfer.destinationClubId);
    const approved = transfer.approvals.filter((item) => item.status === "APPROVED" && item.step !== "OVERRIDE").map((item) => item.step as ApprovalStep);
    const expected = steps.find((step) => !approved.includes(step));
    if (!expected || data.step !== expected) throw new ApiError(422, `Approval berikutnya harus ${expected ?? "tidak ada"}.`);
    approvalStep = expected;
    next = nextTransferStatus(steps, [...approved, expected]);
    auditAction = "APPROVE";
  } else if (data.action === "reject") {
    if (!data.reason) throw new ApiError(422, "Alasan penolakan wajib diisi.");
    if (["COMPLETED", "CANCELLED", "REJECTED"].includes(transfer.status)) throw new ApiError(409, "Transfer sudah final.");
    next = "REJECTED";
    auditAction = "REJECT";
  } else if (data.action === "cancel") {
    if (["COMPLETED", "CANCELLED"].includes(transfer.status)) throw new ApiError(409, "Transfer tidak dapat dibatalkan.");
    next = "CANCELLED";
  } else if (data.action === "complete") {
    if (transfer.status !== "COMPETITION_APPROVED") throw new ApiError(409, "Transfer belum disetujui kompetisi.");
    if (!transfer.effectiveAt || transfer.effectiveAt > new Date()) throw new ApiError(422, "Tanggal efektif transfer belum tercapai.");
    next = "COMPLETED";
  }
  return db.$transaction(async (tx) => {
    const changed = await tx.transferRequest.updateMany({ where: { id, organizationId, version: data.expectedVersion, status: transfer.status }, data: { status: next, version: { increment: 1 }, rejectionReason: data.action === "reject" ? data.reason : undefined, ...(data.overrideWindow ? { overrideReason: data.reason, overrideById: actor.id } : {}) } });
    if (!changed.count) throw new ApiError(409, "Transfer berubah bersamaan. Muat ulang.");
    if (approvalStep) await tx.transferApproval.create({ data: { organizationId, transferId: id, step: approvalStep, status: "APPROVED", actorId: actor.id, notes: data.notes } });
    if (data.overrideWindow) await tx.transferApproval.upsert({ where: { transferId_step: { transferId: id, step: "OVERRIDE" } }, create: { organizationId, transferId: id, step: "OVERRIDE", status: "APPROVED", actorId: actor.id, notes: data.reason }, update: { actorId: actor.id, notes: data.reason } });
    if (data.action === "complete") {
      await tx.rosterEntry.updateMany({ where: { organizationId, seasonId: transfer.seasonId, registration: { playerId: transfer.playerId }, status: "ACTIVE" }, data: { status: "INACTIVE", releasedAt: transfer.effectiveAt } });
      await tx.playerRegistration.updateMany({ where: { organizationId, seasonId: transfer.seasonId, playerId: transfer.playerId, status: "APPROVED" }, data: { status: "CANCELLED" } });
      if (transfer.destinationClubId && transfer.type !== "REGISTRATION_RELEASE") {
        const registration = await tx.playerRegistration.create({ data: { organizationId, competitionId: transfer.competitionId, seasonId: transfer.seasonId, clubId: transfer.destinationClubId, playerId: transfer.playerId, idempotencyKey: `transfer:${transfer.id}`, registrationDate: transfer.effectiveAt!, status: "APPROVED", verificationStatus: "VERIFIED", eligibilityStatus: "ELIGIBLE", approvedById: actor.id, approvedAt: new Date() } });
        await tx.rosterEntry.create({ data: { organizationId, seasonId: transfer.seasonId, clubId: transfer.destinationClubId, registrationId: registration.id, status: "ACTIVE", addedAt: transfer.effectiveAt! } });
      }
      await tx.player.update({ where: { id: transfer.playerId }, data: { activeClubId: transfer.type === "REGISTRATION_RELEASE" ? null : transfer.destinationClubId } });
    }
    await tx.transferHistory.create({ data: { organizationId, transferId: id, actorId: actor.id, fromStatus: transfer.status, toStatus: next, action: data.action.toUpperCase(), snapshot: json({ notes: data.notes, reason: data.reason, step: data.step }) } });
    await audit(tx, actor, organizationId, auditAction, "TransferRequest", id, { status: transfer.status, version: transfer.version }, { status: next, version: transfer.version + 1 });
    return tx.transferRequest.findUniqueOrThrow({ where: { id }, include: transferInclude });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listTransferWindows(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "transfer_window.view");
  const where: Prisma.TransferWindowWhereInput = { organizationId: query.organizationId, ...(query.seasonId ? { seasonId: query.seasonId } : {}), ...(query.status ? { status: query.status as "OPEN" | "CLOSED" } : {}) };
  const [data, total, caps] = await Promise.all([db.transferWindow.findMany({ where, include: { competition: { select: { name: true } }, season: { select: { name: true } } }, orderBy: { opensAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.transferWindow.count({ where }), capabilities(actor, query.organizationId, ["transfer_window.manage"])]);
  return { data, meta: page(total, query), capabilities: caps };
}

export async function createTransferWindow(actor: Actor, input: unknown) {
  const data = transferWindowSchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "transfer_window.manage");
  await validateScope(data.organizationId, data.competitionId, data.seasonId);
  if (data.closesAt <= data.opensAt) throw new ApiError(422, "Waktu tutup harus setelah waktu buka.");
  return db.$transaction(async (tx) => {
    const created = await tx.transferWindow.create({ data: { ...data, registrationDeadline: data.registrationDeadline ?? null, rules: json(data.rules), createdById: actor.id } });
    await audit(tx, actor, data.organizationId, "CREATE", "TransferWindow", created.id, null, { name: created.name, opensAt: created.opensAt, closesAt: created.closesAt });
    return created;
  });
}

export async function listAvailability(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "availability.view");
  const where: Prisma.PlayerAvailabilityWhereInput = { organizationId: query.organizationId, ...(query.playerId ? { playerId: query.playerId } : {}), ...(query.status ? { status: query.status as Prisma.EnumAvailabilityStatusFilter["equals"] } : {}), ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}) };
  const [data, total, caps] = await Promise.all([db.playerAvailability.findMany({ where, include: { player: { select: { id: true, fullName: true, displayName: true } } }, orderBy: { startsAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.playerAvailability.count({ where }), capabilities(actor, query.organizationId, ["availability.manage"])]);
  return { data, meta: page(total, query), capabilities: caps };
}

export async function createAvailability(actor: Actor, input: unknown) {
  const data = availabilitySchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "availability.manage");
  if (!await db.player.findFirst({ where: { id: data.playerId, organizationId: data.organizationId, deletedAt: null } })) throw new ApiError(404, "Pemain tidak ditemukan.");
  if (data.endsAt && data.endsAt < data.startsAt) throw new ApiError(422, "Akhir periode tidak valid.");
  return db.$transaction(async (tx) => {
    const created = await tx.playerAvailability.create({ data: { ...data, publicNote: data.publicNote ?? null, endsAt: data.endsAt ?? null, createdById: actor.id } });
    await audit(tx, actor, data.organizationId, "CREATE", "PlayerAvailability", created.id, null, { playerId: created.playerId, status: created.status, reason: created.reason });
    return created;
  });
}

const injuryInclude = { player: { select: { id: true, fullName: true, displayName: true, photoUrl: true } }, progress: { include: { actor: { select: { name: true } } }, orderBy: { recordedAt: "desc" as const } }, clearances: { include: { actor: { select: { name: true } } }, orderBy: { clearedAt: "desc" as const } } } satisfies Prisma.InjuryCaseInclude;

export async function listInjuries(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "injury.view");
  const where: Prisma.InjuryCaseWhereInput = { organizationId: query.organizationId, ...(query.status ? { status: query.status as Prisma.EnumInjuryStatusFilter["equals"] } : {}), ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}) };
  const [data, total, caps] = await Promise.all([db.injuryCase.findMany({ where, include: injuryInclude, orderBy: { injuryDate: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.injuryCase.count({ where }), capabilities(actor, query.organizationId, ["injury.manage", "injury.clearance"])]);
  await db.auditLog.create({ data: { organizationId: query.organizationId, actorId: actor.id, action: "VIEW", resourceType: "InjuryCaseList", after: json({ count: data.length }) } });
  return { data, meta: page(total, query), capabilities: caps };
}

export async function createInjury(actor: Actor, input: unknown) {
  const data = injurySchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "injury.manage");
  if (!await db.player.findFirst({ where: { id: data.playerId, organizationId: data.organizationId, deletedAt: null } })) throw new ApiError(404, "Pemain tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const injury = await tx.injuryCase.create({ data: { ...data, estimatedReturn: data.estimatedReturn ?? null, diagnosis: data.diagnosis ?? null, medicalNotes: data.medicalNotes ?? null, publicNote: data.publicNote ?? null, createdById: actor.id } });
    await tx.playerAvailability.create({ data: { organizationId: data.organizationId, playerId: data.playerId, status: "INJURED", reason: "Cedera belum memperoleh medical clearance", sourceType: "INJURY", sourceId: injury.id, publicNote: data.publicNote ?? null, publicApproved: data.publicApproved, startsAt: data.injuryDate, createdById: actor.id } });
    await audit(tx, actor, data.organizationId, "CREATE", "InjuryCase", injury.id, null, { playerId: injury.playerId, status: injury.status, injuryDate: injury.injuryDate });
    return injury;
  });
}

export async function updateInjury(actor: Actor, organizationId: string, id: string, input: unknown) {
  const data = injuryProgressSchema.parse(input);
  await authorizeOrganization(actor, organizationId, "injury.manage");
  const injury = await db.injuryCase.findFirst({ where: { id, organizationId } });
  if (!injury) throw new ApiError(404, "Kasus cedera tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const changed = await tx.injuryCase.updateMany({ where: { id, version: data.expectedVersion }, data: { status: data.status, version: { increment: 1 }, ...(data.status === "CLOSED" ? { actualReturn: new Date() } : {}) } });
    if (!changed.count) throw new ApiError(409, "Kasus cedera telah berubah.");
    const progress = await tx.injuryProgress.create({ data: { injuryId: id, status: data.status, privateNotes: data.privateNotes ?? null, publicNote: data.publicNote ?? null, actorId: actor.id } });
    await audit(tx, actor, organizationId, "UPDATE", "InjuryCase", id, { status: injury.status }, { status: data.status });
    return progress;
  });
}

export async function clearInjury(actor: Actor, organizationId: string, id: string, input: unknown) {
  const data = clearanceSchema.parse(input);
  await authorizeOrganization(actor, organizationId, "injury.clearance");
  const injury = await db.injuryCase.findFirst({ where: { id, organizationId } });
  if (!injury) throw new ApiError(404, "Kasus cedera tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const changed = await tx.injuryCase.updateMany({ where: { id, version: data.expectedVersion }, data: { status: "CLEARED", actualReturn: data.clearedAt, version: { increment: 1 } } });
    if (!changed.count) throw new ApiError(409, "Kasus cedera telah berubah.");
    const clearance = await tx.medicalClearance.create({ data: { injuryId: id, clearedAt: data.clearedAt, notes: data.notes ?? null, actorId: actor.id } });
    await tx.playerAvailability.updateMany({ where: { organizationId, sourceType: "INJURY", sourceId: id, endsAt: null }, data: { endsAt: data.clearedAt } });
    await audit(tx, actor, organizationId, "APPROVE", "MedicalClearance", clearance.id, null, { injuryId: id, clearedAt: data.clearedAt });
    return clearance;
  });
}

export async function listSuspensions(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "suspension.view");
  const where: Prisma.SuspensionWhereInput = { organizationId: query.organizationId, ...(query.status ? { status: query.status as Prisma.EnumSuspensionStatusFilter["equals"] } : {}), ...(query.seasonId ? { seasonId: query.seasonId } : {}), ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}) };
  const [data, total, caps] = await Promise.all([db.suspension.findMany({ where, include: { player: { select: { id: true, fullName: true, displayName: true } }, competition: { select: { name: true } }, season: { select: { name: true } }, services: { include: { match: { select: { matchNumber: true, kickoffAt: true } } } } }, orderBy: { effectiveAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.suspension.count({ where }), capabilities(actor, query.organizationId, ["suspension.manage"])]);
  return { data, meta: page(total, query), capabilities: caps };
}

export async function createManualSuspension(actor: Actor, input: unknown) {
  const data = suspensionSchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "suspension.manage");
  await validateScope(data.organizationId, data.competitionId, data.seasonId);
  if (!await db.player.findFirst({ where: { id: data.playerId, organizationId: data.organizationId, deletedAt: null } })) throw new ApiError(404, "Pemain tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const suspension = await tx.suspension.create({ data: { organizationId: data.organizationId, competitionId: data.competitionId, seasonId: data.seasonId, playerId: data.playerId, type: "MANUAL", reason: data.reason, sourceKey: `manual:${randomUUID()}`, effectiveAt: data.effectiveAt, endsAt: data.endsAt ?? null, originalMatchBans: data.matchBans ?? null, remainingMatchBans: data.matchBans ?? null, issuedById: actor.id } });
    await tx.playerAvailability.create({ data: { organizationId: data.organizationId, playerId: data.playerId, status: "SUSPENDED", reason: data.reason, sourceType: "SUSPENSION", sourceId: suspension.id, startsAt: data.effectiveAt, endsAt: data.endsAt ?? null, createdById: actor.id } });
    await audit(tx, actor, data.organizationId, "CREATE", "Suspension", suspension.id, null, { playerId: suspension.playerId, reason: suspension.reason, matchBans: suspension.originalMatchBans });
    return suspension;
  });
}

export async function listDiscipline(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "discipline.view");
  const where: Prisma.DisciplinaryCaseWhereInput = { organizationId: query.organizationId, ...(query.status ? { status: query.status as Prisma.EnumDisciplinaryCaseStatusFilter["equals"] } : {}), ...(query.seasonId ? { seasonId: query.seasonId } : {}), ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}) };
  const [data, total, caps] = await Promise.all([db.disciplinaryCase.findMany({ where, include: { player: { select: { id: true, fullName: true } }, decisions: true, appeals: true, suspensions: true }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.disciplinaryCase.count({ where }), capabilities(actor, query.organizationId, ["discipline.manage", "discipline.approve", "discipline.appeal"])]);
  return { data, meta: page(total, query), capabilities: caps };
}

export async function createDisciplinaryCase(actor: Actor, input: unknown) {
  const data = disciplinaryCaseSchema.parse(input);
  await authorizeOrganization(actor, data.organizationId, "discipline.manage");
  await validateScope(data.organizationId, data.competitionId, data.seasonId);
  const [player, match, event] = await Promise.all([
    db.player.findFirst({ where: { id: data.playerId, organizationId: data.organizationId, deletedAt: null } }),
    data.matchId ? db.match.findFirst({ where: { id: data.matchId, organizationId: data.organizationId, competitionId: data.competitionId, seasonId: data.seasonId } }) : Promise.resolve(null),
    data.eventId ? db.matchEvent.findFirst({ where: { id: data.eventId, organizationId: data.organizationId, ...(data.matchId ? { matchId: data.matchId } : {}) } }) : Promise.resolve(null),
  ]);
  if (!player) throw new ApiError(404, "Pemain tidak ditemukan.");
  if (data.matchId && !match) throw new ApiError(422, "Pertandingan tidak valid untuk cakupan kasus.");
  if (data.eventId && !event) throw new ApiError(422, "Event pertandingan tidak valid.");
  return db.$transaction(async (tx) => {
    const created = await tx.disciplinaryCase.create({ data: { organizationId: data.organizationId, competitionId: data.competitionId, seasonId: data.seasonId, playerId: data.playerId, matchId: data.matchId ?? null, eventId: data.eventId ?? null, sourceKey: `manual:${randomUUID()}`, summary: data.summary, createdById: actor.id } });
    await audit(tx, actor, data.organizationId, "CREATE", "DisciplinaryCase", created.id, null, { playerId: created.playerId, summary: created.summary });
    return created;
  });
}

export async function decideDiscipline(actor: Actor, organizationId: string, caseId: string, input: unknown) {
  const data = decisionSchema.parse(input);
  await authorizeOrganization(actor, organizationId, "discipline.approve");
  const disciplinaryCase = await db.disciplinaryCase.findFirst({ where: { id: caseId, organizationId } });
  if (!disciplinaryCase) throw new ApiError(404, "Kasus disiplin tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const decision = await tx.disciplinaryDecision.create({ data: { caseId, type: data.type, reason: data.reason, matchBans: data.matchBans ?? null, startsAt: data.startsAt ?? null, endsAt: data.endsAt ?? null, pointPenalty: data.pointPenalty ?? null, approvedById: actor.id } });
    if (["MATCH_BAN", "DATE_SUSPENSION"].includes(data.type)) {
      const suspension = await tx.suspension.create({ data: { organizationId, competitionId: disciplinaryCase.competitionId, seasonId: disciplinaryCase.seasonId, playerId: disciplinaryCase.playerId, disciplinaryCaseId: caseId, type: "MANUAL", reason: data.reason, sourceKey: `decision:${decision.id}`, effectiveAt: data.startsAt ?? new Date(), endsAt: data.endsAt ?? null, originalMatchBans: data.matchBans ?? null, remainingMatchBans: data.matchBans ?? null, issuedById: actor.id } });
      await tx.playerAvailability.create({ data: { organizationId, playerId: disciplinaryCase.playerId, status: "SUSPENDED", reason: data.reason, sourceType: "SUSPENSION", sourceId: suspension.id, startsAt: suspension.effectiveAt, endsAt: suspension.endsAt, createdById: actor.id } });
    }
    if (data.type === "POINT_PENALTY") {
      if (!data.clubId || !data.pointPenalty) throw new ApiError(422, "Klub dan nilai penalti poin wajib diisi.");
      await tx.pointAdjustment.create({ data: { organizationId, competitionId: disciplinaryCase.competitionId, seasonId: disciplinaryCase.seasonId, clubId: data.clubId, amount: data.pointPenalty, reason: data.reason, approvedById: actor.id, effectiveAt: data.startsAt ?? new Date() } });
    }
    await tx.disciplinaryCase.update({ where: { id: caseId }, data: { status: "DECIDED" } });
    await audit(tx, actor, organizationId, "APPROVE", "DisciplinaryDecision", decision.id, null, { caseId, type: decision.type });
    return decision;
  });
}

export async function appealDiscipline(actor: Actor, organizationId: string, caseId: string, input: unknown) {
  const data = appealSchema.parse(input);
  await authorizeOrganization(actor, organizationId, "discipline.appeal");
  const disciplinaryCase = await db.disciplinaryCase.findFirst({ where: { id: caseId, organizationId } });
  if (!disciplinaryCase) throw new ApiError(404, "Kasus disiplin tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const appeal = await tx.disciplinaryAppeal.create({ data: { caseId, reason: data.reason, actorId: actor.id } });
    await tx.disciplinaryCase.update({ where: { id: caseId }, data: { status: "APPEALED" } });
    await tx.suspension.updateMany({ where: { disciplinaryCaseId: caseId, status: "ACTIVE" }, data: { appealStatus: "PENDING" } });
    await audit(tx, actor, organizationId, "CREATE", "DisciplinaryAppeal", appeal.id, null, { caseId, status: appeal.status });
    return appeal;
  });
}

async function disciplineRules(competitionId: string) {
  const record = await db.competitionRule.findUnique({ where: { competitionId_key: { competitionId, key: "discipline_rules" } } });
  const value = (record?.value ?? {}) as Record<string, unknown>;
  return {
    yellowThreshold: Math.max(1, Number(value.yellowThreshold) || 3),
    yellowMatchBans: Math.max(1, Number(value.yellowMatchBans) || 1),
    secondYellowMatchBans: Math.max(1, Number(value.secondYellowMatchBans) || 1),
    redCardMatchBans: Math.max(1, Number(value.redCardMatchBans) || 1),
  };
}

export async function reconcileDiscipline(actor: Actor, organizationId: string, competitionId: string, seasonId: string) {
  const rules = await disciplineRules(competitionId);
  const events = await db.matchEvent.findMany({
    where: { organizationId, match: { competitionId, seasonId, status: "OFFICIAL" }, eventType: { in: ["YELLOW_CARD", "SECOND_YELLOW_CARD", "RED_CARD"] } },
    include: { match: { select: { status: true, kickoffAt: true } } },
    orderBy: [{ match: { kickoffAt: "asc" } }, { minute: "asc" }, { id: "asc" }],
  });
  const specs = automaticSuspensionSpecs(events.map((event) => ({ id: event.id, playerId: event.playerId, type: event.eventType as "YELLOW_CARD" | "SECOND_YELLOW_CARD" | "RED_CARD", isValid: event.isValid, matchStatus: event.match.status })), seasonId, rules);
  const desired = new Set(specs.map((spec) => spec.sourceKey));
  await db.$transaction(async (tx) => {
    const obsolete = await tx.suspension.findMany({ where: { organizationId, competitionId, seasonId, type: "AUTOMATIC", sourceKey: { notIn: [...desired] } }, select: { id: true } });
    if (obsolete.length) {
      await tx.suspension.updateMany({ where: { id: { in: obsolete.map((item) => item.id) } }, data: { status: "CANCELLED" } });
      await tx.playerAvailability.updateMany({ where: { sourceType: "SUSPENSION", sourceId: { in: obsolete.map((item) => item.id) }, endsAt: null }, data: { endsAt: new Date() } });
    }
    for (const spec of specs) {
      const event = spec.eventId ? events.find((item) => item.id === spec.eventId) : undefined;
      const disciplinaryCase = await tx.disciplinaryCase.upsert({ where: { organizationId_sourceKey: { organizationId, sourceKey: spec.sourceKey } }, create: { organizationId, competitionId, seasonId, playerId: spec.playerId, matchId: event?.matchId, eventId: event?.id, sourceKey: spec.sourceKey, cardType: event?.eventType, status: "DECIDED", summary: spec.reason, createdById: actor.id }, update: { status: "DECIDED", summary: spec.reason } });
      const existing = await tx.suspension.findUnique({ where: { organizationId_sourceKey: { organizationId, sourceKey: spec.sourceKey } }, include: { _count: { select: { services: true } } } });
      const restoredRemaining = Math.max(0, spec.matchBans - (existing?._count.services ?? 0));
      const suspension = existing
        ? await tx.suspension.update({ where: { id: existing.id }, data: { status: restoredRemaining === 0 ? "SERVED" : "ACTIVE", disciplinaryCaseId: disciplinaryCase.id, reason: spec.reason, originalMatchBans: spec.matchBans, remainingMatchBans: Math.min(existing.remainingMatchBans ?? restoredRemaining, restoredRemaining) } })
        : await tx.suspension.create({ data: { organizationId, competitionId, seasonId, playerId: spec.playerId, disciplinaryCaseId: disciplinaryCase.id, type: "AUTOMATIC", reason: spec.reason, sourceKey: spec.sourceKey, effectiveAt: event?.match.kickoffAt ?? new Date(), originalMatchBans: spec.matchBans, remainingMatchBans: spec.matchBans, issuedById: actor.id } });
      await tx.playerAvailability.upsert({ where: { sourceType_sourceId: { sourceType: "SUSPENSION", sourceId: suspension.id } }, create: { organizationId, playerId: spec.playerId, status: "SUSPENDED", reason: spec.reason, sourceType: "SUSPENSION", sourceId: suspension.id, startsAt: suspension.effectiveAt, endsAt: suspension.status === "SERVED" ? new Date() : null, createdById: actor.id }, update: { reason: spec.reason, endsAt: suspension.status === "SERVED" ? new Date() : null } });
    }
  });
  return { automaticSuspensions: specs.length };
}

export async function serveSuspensionsForOfficialMatch(organizationId: string, matchId: string) {
  const match = await db.match.findFirst({ where: { id: matchId, organizationId, status: "OFFICIAL" }, include: { homeTeam: true, awayTeam: true } });
  if (!match) return { served: 0 };
  const clubIds = [match.homeTeam.clubId, match.awayTeam.clubId];
  const registrations = await db.playerRegistration.findMany({ where: { organizationId, seasonId: match.seasonId, clubId: { in: clubIds }, status: "APPROVED" }, select: { playerId: true } });
  const suspensions = await db.suspension.findMany({ where: { organizationId, seasonId: match.seasonId, playerId: { in: registrations.map((item) => item.playerId) }, status: "ACTIVE", effectiveAt: { lt: match.kickoffAt ?? new Date() }, remainingMatchBans: { gt: 0 }, services: { none: { matchId } } } });
  await db.$transaction(async (tx) => {
    for (const suspension of suspensions) {
      const remaining = Math.max(0, (suspension.remainingMatchBans ?? 0) - 1);
      await tx.suspensionService.create({ data: { suspensionId: suspension.id, matchId } });
      await tx.suspension.update({ where: { id: suspension.id }, data: { remainingMatchBans: remaining, ...(remaining === 0 ? { status: "SERVED" } : {}) } });
      if (remaining === 0) await tx.playerAvailability.updateMany({ where: { sourceType: "SUSPENSION", sourceId: suspension.id, endsAt: null }, data: { endsAt: match.kickoffAt ?? new Date() } });
    }
  });
  return { served: suspensions.length };
}

export async function phase6Lookups(actor: Actor, organizationId: string) {
  const access = await capabilities(actor, organizationId, ["transfer.view", "availability.view", "injury.view", "discipline.view", "suspension.view"]);
  if (!Object.values(access).some(Boolean)) throw new ApiError(403, "Tidak memiliki akses Phase 6.");
  const [players, clubs, competitions, seasons, windows] = await Promise.all([
    db.player.findMany({ where: { organizationId, deletedAt: null, status: "ACTIVE" }, select: { id: true, fullName: true, activeClubId: true }, orderBy: { fullName: "asc" } }),
    db.club.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.competition.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.season.findMany({ where: { competition: { organizationId, deletedAt: null } }, select: { id: true, name: true, competitionId: true }, orderBy: { startsAt: "desc" } }),
    db.transferWindow.findMany({ where: { organizationId }, select: { id: true, name: true, seasonId: true, status: true }, orderBy: { opensAt: "desc" } }),
  ]);
  return { players, clubs, competitions, seasons, windows, capabilities: access };
}

export async function publicAvailability(organizationId: string, playerId: string, at = new Date()) {
  if (!await db.organization.findFirst({ where: { id: organizationId, status: "ACTIVE", deletedAt: null } })) throw new ApiError(404, "Organisasi tidak ditemukan.");
  return db.playerAvailability.findMany({ where: { organizationId, playerId, publicApproved: true, startsAt: { lte: at }, OR: [{ endsAt: null }, { endsAt: { gte: at } }] }, select: { status: true, publicNote: true, startsAt: true, endsAt: true } });
}
