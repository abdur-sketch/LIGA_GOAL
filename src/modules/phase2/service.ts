import { Prisma, type AuditAction, type RegistrationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, authorizeOrganization, capabilities, type getApiActor } from "@/lib/auth/api";
import type { PermissionKey } from "@/lib/auth/permissions";
import { competitionRulesSchema, documentMetaSchema, documentVerificationSchema, playerSchema, registrationSchema, rosterSchema, workflowSchema } from "./validation";
import { evaluateEligibility, unavailableSuspensionGateway } from "./eligibility";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
export type Query = { organizationId: string; search: string; status?: string; page: number; pageSize: number; seasonId?: string; clubId?: string };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function audit(tx: Prisma.TransactionClient, actor: Actor, organizationId: string, action: AuditAction, resourceType: string, resourceId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({ data: { actorId: actor.id, organizationId, action, resourceType, resourceId, before: before == null ? Prisma.JsonNull : json(before), after: after == null ? Prisma.JsonNull : json(after) } });
}
const meta = (total: number, query: Query) => ({ page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) });

export async function listPlayers(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "player.view");
  const where: Prisma.PlayerWhereInput = { organizationId: query.organizationId, deletedAt: null,
    ...(query.search ? { OR: [{ fullName: { contains: query.search, mode: "insensitive" } }, { displayName: { contains: query.search, mode: "insensitive" } }] } : {}),
    ...(query.status ? { status: query.status as Prisma.EnumPlayerStatusFilter["equals"] } : {}) };
  const [data, total, caps] = await Promise.all([
    db.player.findMany({ where, select: { id: true, fullName: true, displayName: true, photoUrl: true, dateOfBirth: true, nationality: true, primaryPosition: true, status: true, activeClub: { select: { id: true, name: true } }, _count: { select: { registrations: true } } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    db.player.count({ where }), capabilities(actor, query.organizationId, ["player.create", "player.update", "player.archive"]),
  ]);
  return { data, meta: meta(total, query), capabilities: { create: caps["player.create"], update: caps["player.update"], archive: caps["player.archive"] } };
}

export async function getPlayer(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "player.view");
  const caps = await capabilities(actor, organizationId, ["player.update", "player.archive", "player_document.view", "player_document.upload", "player_document.verify"]);
  const canPrivate = actor.isPlatformAdmin || caps["player_document.view"];
  const player = await db.player.findFirst({ where: { id, organizationId, deletedAt: null }, include: {
    activeClub: { select: { id: true, name: true } }, privateProfile: canPrivate,
    registrations: { include: { competition: { select: { name: true } }, season: { select: { name: true } }, club: { select: { name: true } }, history: { orderBy: { createdAt: "desc" } } }, orderBy: { registrationDate: "desc" } },
    documents: canPrivate ? { where: { isCurrent: true }, select: { id: true, type: true, label: true, originalName: true, mimeType: true, sizeBytes: true, version: true, verificationStatus: true, rejectionNotes: true, createdAt: true, verifications: { select: { status: true, notes: true, createdAt: true, verifier: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } } : false,
  } });
  if (!player) throw new ApiError(404, "Pemain tidak ditemukan.");
  return { ...player, _capabilities: caps };
}

export async function createPlayer(actor: Actor, organizationId: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "player.create");
  const data = playerSchema.parse(input);
  if (data.activeClubId && !await db.club.findFirst({ where: { id: data.activeClubId, organizationId, deletedAt: null } })) throw new ApiError(400, "Klub aktif tidak valid.");
  const duplicate = await db.player.findFirst({ where: { organizationId, deletedAt: null, fullName: { equals: data.fullName, mode: "insensitive" }, dateOfBirth: data.dateOfBirth } });
  if (duplicate) throw new ApiError(409, "Pemain dengan nama dan tanggal lahir yang sama sudah ada.");
  return db.$transaction(async (tx) => {
    const { privateProfile, ...publicData } = data;
    const player = await tx.player.create({ data: { organizationId, ...publicData, ...(privateProfile ? { privateProfile: { create: privateProfile } } : {}) } });
    await audit(tx, actor, organizationId, "CREATE", "Player", player.id, null, { id: player.id, fullName: player.fullName, status: player.status });
    return player;
  });
}

export async function updatePlayer(actor: Actor, organizationId: string, id: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "player.update");
  const before = await db.player.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!before) throw new ApiError(404, "Pemain tidak ditemukan.");
  const data = playerSchema.parse(input); const { privateProfile, ...publicData } = data;
  if (data.activeClubId && !await db.club.findFirst({ where: { id: data.activeClubId, organizationId, deletedAt: null } })) throw new ApiError(400, "Klub aktif tidak valid.");
  return db.$transaction(async (tx) => {
    const player = await tx.player.update({ where: { id }, data: { ...publicData, ...(privateProfile ? { privateProfile: { upsert: { create: privateProfile, update: privateProfile } } } : {}) } });
    await audit(tx, actor, organizationId, "UPDATE", "Player", id, { fullName: before.fullName, status: before.status }, { fullName: player.fullName, status: player.status });
    return player;
  });
}

export async function archivePlayer(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "player.archive");
  const before = await db.player.findFirst({ where: { id, organizationId, deletedAt: null } });
  if (!before) throw new ApiError(404, "Pemain tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const player = await tx.player.update({ where: { id }, data: { status: "ARCHIVED", deletedAt: new Date() } });
    await audit(tx, actor, organizationId, "DELETE", "Player", id, { status: before.status }, { status: "ARCHIVED" }); return player;
  });
}

const registrationInclude = { player: { select: { id: true, fullName: true, displayName: true, photoUrl: true, dateOfBirth: true, primaryPosition: true } }, competition: { select: { id: true, name: true } }, season: { select: { id: true, name: true } }, club: { select: { id: true, name: true, shortName: true } } } satisfies Prisma.PlayerRegistrationInclude;

export async function listRegistrations(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "registration.view");
  const where: Prisma.PlayerRegistrationWhereInput = { organizationId: query.organizationId, ...(query.status ? { status: query.status as Prisma.EnumRegistrationStatusFilter["equals"] } : {}), ...(query.seasonId ? { seasonId: query.seasonId } : {}), ...(query.clubId ? { clubId: query.clubId } : {}), ...(query.search ? { player: { fullName: { contains: query.search, mode: "insensitive" } } } : {}) };
  const [data, total, caps] = await Promise.all([db.playerRegistration.findMany({ where, include: registrationInclude, orderBy: { registrationDate: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.playerRegistration.count({ where }), capabilities(actor, query.organizationId, ["registration.create", "registration.submit", "registration.verify", "registration.approve", "registration.reject"])]);
  return { data, meta: meta(total, query), capabilities: caps };
}

export async function getRegistration(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "registration.view");
  const caps = await capabilities(actor, organizationId, ["registration.submit", "registration.verify", "registration.approve", "registration.reject", "player_document.upload", "player_document.view", "player_document.verify"]);
  const item = await db.playerRegistration.findFirst({ where: { id, organizationId }, include: { ...registrationInclude, history: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: "desc" } }, eligibilityChecks: { orderBy: { checkedAt: "desc" }, take: 10 }, documents: caps["player_document.view"] ? { where: { isCurrent: true }, select: { id: true, type: true, originalName: true, verificationStatus: true, rejectionNotes: true, version: true, createdAt: true, verifications: { select: { status: true, notes: true, createdAt: true, verifier: { select: { name: true } } }, orderBy: { createdAt: "desc" } } } } : false, rosterEntry: true } });
  if (!item) throw new ApiError(404, "Registrasi tidak ditemukan."); return { ...item, _capabilities: caps };
}

export async function createRegistration(actor: Actor, organizationId: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "registration.create"); const data = registrationSchema.parse(input);
  const existingIdempotent = await db.playerRegistration.findUnique({ where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: data.idempotencyKey } }, include: registrationInclude });
  if (existingIdempotent) return existingIdempotent;
  const [player, season, club, participation] = await Promise.all([
    db.player.findFirst({ where: { id: data.playerId, organizationId, deletedAt: null, status: { not: "ARCHIVED" } } }),
    db.season.findFirst({ where: { id: data.seasonId, competitionId: data.competitionId, competition: { organizationId, deletedAt: null } } }),
    db.club.findFirst({ where: { id: data.clubId, organizationId, deletedAt: null } }),
    db.competitionClub.findFirst({ where: { organizationId, seasonId: data.seasonId, clubId: data.clubId, competitionId: data.competitionId, status: "APPROVED" } }),
  ]);
  if (!player || !season || !club) throw new ApiError(400, "Pemain, kompetisi, musim, atau klub tidak valid untuk organisasi ini.");
  if (!participation) throw new ApiError(422, "Klub belum disetujui untuk musim kompetisi ini.");
  const conflicting = await db.playerRegistration.findFirst({ where: { seasonId: data.seasonId, playerId: data.playerId, status: { notIn: ["REJECTED", "CANCELLED"] } } });
  if (conflicting) throw new ApiError(409, "Pemain sudah memiliki registrasi aktif pada musim ini.");
  return db.$transaction(async (tx) => {
    const created = await tx.playerRegistration.create({ data: { organizationId, ...data }, include: registrationInclude });
    await tx.registrationHistory.create({ data: { organizationId, registrationId: created.id, actorId: actor.id, toStatus: "DRAFT", action: "CREATED" } });
    await audit(tx, actor, organizationId, "CREATE", "PlayerRegistration", created.id, null, { playerId: data.playerId, seasonId: data.seasonId, clubId: data.clubId }); return created;
  });
}

async function rulesFor(competitionId: string) {
  const record = await db.competitionRule.findUnique({ where: { competitionId_key: { competitionId, key: "player_registration" } } });
  return competitionRulesSchema.parse(record?.value || {});
}

export async function runEligibility(actor: Actor, organizationId: string, registrationId: string, forApproval = false) {
  const registration = await db.playerRegistration.findFirst({ where: { id: registrationId, organizationId }, include: { player: true, documents: { where: { isCurrent: true, verificationStatus: "APPROVED" }, select: { type: true } } } });
  if (!registration) throw new ApiError(404, "Registrasi tidak ditemukan.");
  const rules = await rulesFor(registration.competitionId);
  const [clubApproved, duplicateActiveRegistration, activeSquadCount, jerseyConflict, suspension] = await Promise.all([
    db.competitionClub.findFirst({ where: { organizationId, competitionId: registration.competitionId, seasonId: registration.seasonId, clubId: registration.clubId, status: "APPROVED" } }).then(Boolean),
    db.playerRegistration.findFirst({ where: { id: { not: registration.id }, seasonId: registration.seasonId, playerId: registration.playerId, status: { notIn: ["REJECTED", "CANCELLED"] } } }).then(Boolean),
    db.rosterEntry.count({ where: { seasonId: registration.seasonId, clubId: registration.clubId, status: "ACTIVE" } }),
    registration.jerseyNumber == null ? Promise.resolve(false) : db.rosterEntry.findFirst({ where: { seasonId: registration.seasonId, clubId: registration.clubId, jerseyNumber: registration.jerseyNumber, status: "ACTIVE", registrationId: { not: registration.id } } }).then(Boolean),
    unavailableSuspensionGateway.check(registration.playerId, registration.seasonId),
  ]);
  const check = evaluateEligibility({ status: registration.status, verificationStatus: registration.verificationStatus, dateOfBirth: registration.player.dateOfBirth, jerseyNumber: registration.jerseyNumber, clubApproved, duplicateActiveRegistration, activeSquadCount, jerseyConflict, approvedDocumentTypes: registration.documents.map((document) => document.type), now: new Date(), rules, forApproval, suspension });
  await db.$transaction([db.eligibilityCheck.create({ data: { organizationId, registrationId, result: check.result, reasons: json(check.reasons), ruleSnapshot: json({ ...rules, suspensionCheck: check.suspensionCheck }) } }), db.playerRegistration.update({ where: { id: registrationId }, data: { eligibilityStatus: check.result } })]);
  return check;
}

const transitions: Record<string, { permission: PermissionKey; allowed: RegistrationStatus[]; next: RegistrationStatus; verification?: "VERIFIED" | "REJECTED"; audit: AuditAction }> = {
  submit: { permission: "registration.submit", allowed: ["DRAFT"], next: "SUBMITTED", audit: "UPDATE" },
  verify: { permission: "registration.verify", allowed: ["SUBMITTED", "UNDER_REVIEW"], next: "UNDER_REVIEW", verification: "VERIFIED", audit: "UPDATE" },
  approve: { permission: "registration.approve", allowed: ["SUBMITTED", "UNDER_REVIEW"], next: "APPROVED", audit: "APPROVE" },
  reject: { permission: "registration.reject", allowed: ["SUBMITTED", "UNDER_REVIEW"], next: "REJECTED", verification: "REJECTED", audit: "REJECT" },
};

export async function transitionRegistration(actor: Actor, organizationId: string, id: string, action: keyof typeof transitions, input: unknown) {
  const config = transitions[action]; if (!config) throw new ApiError(404, "Aksi registrasi tidak ditemukan."); await authorizeOrganization(actor, organizationId, config.permission);
  const payload = workflowSchema.parse(input); const before = await db.playerRegistration.findFirst({ where: { id, organizationId } });
  if (!before) throw new ApiError(404, "Registrasi tidak ditemukan."); if (!config.allowed.includes(before.status)) throw new ApiError(409, `Status ${before.status} tidak dapat menjalankan aksi ${action}.`);
  if (action === "reject" && !payload.reason) throw new ApiError(422, "Alasan penolakan wajib diisi.");
  if (action === "approve") { if (before.verificationStatus !== "VERIFIED") throw new ApiError(422, "Registrasi harus diverifikasi sebelum approval."); const check = await runEligibility(actor, organizationId, id, true); if (check.result !== "ELIGIBLE") throw new ApiError(422, "Registrasi belum eligible untuk disetujui.", check.reasons); }
  return db.$transaction(async (tx) => {
    const updated = await tx.playerRegistration.update({ where: { id }, data: { status: config.next, ...(config.verification ? { verificationStatus: config.verification } : {}), ...(action === "approve" ? { approvedById: actor.id, approvedAt: new Date(), rejectionReason: null, eligibilityStatus: "ELIGIBLE" } : {}), ...(action === "reject" ? { rejectionReason: payload.reason } : {}) } });
    await tx.registrationHistory.create({ data: { organizationId, registrationId: id, actorId: actor.id, fromStatus: before.status, toStatus: config.next, action: action.toUpperCase(), reason: payload.reason } });
    await audit(tx, actor, organizationId, config.audit, "PlayerRegistration", id, { status: before.status }, { status: updated.status }); return updated;
  });
}

export async function listRoster(actor: Actor, query: Query) {
  await authorizeOrganization(actor, query.organizationId, "squad.view");
  const where: Prisma.RosterEntryWhereInput = { organizationId: query.organizationId, ...(query.seasonId ? { seasonId: query.seasonId } : {}), ...(query.clubId ? { clubId: query.clubId } : {}), ...(query.status ? { status: query.status as Prisma.EnumRosterStatusFilter["equals"] } : {}), ...(query.search ? { registration: { player: { fullName: { contains: query.search, mode: "insensitive" } } } } : {}) };
  const [data, total, caps] = await Promise.all([db.rosterEntry.findMany({ where, include: { club: { select: { name: true } }, season: { select: { name: true, competition: { select: { name: true } } } }, registration: { include: registrationInclude } }, orderBy: [{ jerseyNumber: "asc" }, { addedAt: "desc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }), db.rosterEntry.count({ where }), capabilities(actor, query.organizationId, ["squad.manage"])]);
  return { data, meta: meta(total, query), capabilities: { manage: caps["squad.manage"] } };
}

export async function addRosterEntry(actor: Actor, organizationId: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "squad.manage"); const data = rosterSchema.parse(input);
  const registration = await db.playerRegistration.findFirst({ where: { id: data.registrationId, organizationId }, include: { player: true } });
  if (!registration) throw new ApiError(404, "Registrasi tidak ditemukan.");
  const check = await runEligibility(actor, organizationId, registration.id); if (check.result !== "ELIGIBLE") throw new ApiError(422, "Hanya pemain eligible yang dapat masuk skuad.", check.reasons);
  const rules = await rulesFor(registration.competitionId); const jersey = data.jerseyNumber ?? registration.jerseyNumber;
  if (rules.jerseyRequired && jersey == null) throw new ApiError(422, "Nomor punggung wajib diisi.");
  return db.$transaction(async (tx) => {
    if (rules.uniqueJersey && jersey != null && await tx.rosterEntry.findFirst({ where: { seasonId: registration.seasonId, clubId: registration.clubId, jerseyNumber: jersey, status: "ACTIVE" } })) throw new ApiError(409, "Nomor punggung sudah digunakan dalam skuad aktif.");
    if (rules.squadLimit && await tx.rosterEntry.count({ where: { seasonId: registration.seasonId, clubId: registration.clubId, status: "ACTIVE" } }) >= rules.squadLimit) throw new ApiError(422, "Batas jumlah skuad telah tercapai.");
    const entry = await tx.rosterEntry.create({ data: { organizationId, seasonId: registration.seasonId, clubId: registration.clubId, registrationId: registration.id, jerseyNumber: jersey, position: data.position || registration.player.primaryPosition } }); await audit(tx, actor, organizationId, "CREATE", "RosterEntry", entry.id, null, entry); return entry;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function releaseRosterEntry(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "squad.manage"); const before = await db.rosterEntry.findFirst({ where: { id, organizationId, status: "ACTIVE" } }); if (!before) throw new ApiError(404, "Entri skuad aktif tidak ditemukan.");
  return db.$transaction(async (tx) => { const entry = await tx.rosterEntry.update({ where: { id }, data: { status: "INACTIVE", releasedAt: new Date() } }); await audit(tx, actor, organizationId, "UPDATE", "RosterEntry", id, before, entry); return entry; });
}

export async function lookups(actor: Actor, organizationId: string) {
  const access = await capabilities(actor, organizationId, ["player.view", "registration.view", "squad.view"]); if (!Object.values(access).some(Boolean)) throw new ApiError(403, "Anda tidak memiliki izin untuk melihat referensi ini.");
  const [players, clubs, competitions, seasons, registrations] = await Promise.all([
    db.player.findMany({ where: { organizationId, deletedAt: null, status: "ACTIVE" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    db.club.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.competition.findMany({ where: { organizationId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.season.findMany({ where: { competition: { organizationId, deletedAt: null } }, select: { id: true, name: true, competitionId: true }, orderBy: { startsAt: "desc" } }),
    db.playerRegistration.findMany({ where: { organizationId, status: "APPROVED", rosterEntry: null }, select: { id: true, player: { select: { fullName: true } }, clubId: true, seasonId: true, jerseyNumber: true }, orderBy: { registrationDate: "desc" } }),
  ]); return { players, clubs, competitions, seasons, registrations };
}

export async function getEligibilityRules(actor: Actor, organizationId: string, competitionId: string) {
  await authorizeOrganization(actor, organizationId, "competition.view"); const competition = await db.competition.findFirst({ where: { id: competitionId, organizationId, deletedAt: null } }); if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan."); return rulesFor(competitionId);
}

export async function saveEligibilityRules(actor: Actor, organizationId: string, competitionId: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "competition.update"); const competition = await db.competition.findFirst({ where: { id: competitionId, organizationId, deletedAt: null } }); if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan."); const rules = competitionRulesSchema.parse(input);
  return db.$transaction(async (tx) => { const before = await tx.competitionRule.findUnique({ where: { competitionId_key: { competitionId, key: "player_registration" } } }); const record = await tx.competitionRule.upsert({ where: { competitionId_key: { competitionId, key: "player_registration" } }, update: { value: json(rules) }, create: { competitionId, key: "player_registration", value: json(rules) } }); await audit(tx, actor, organizationId, "UPDATE", "CompetitionEligibilityRules", record.id, before?.value, rules); return rules; });
}

export async function registerDocument(actor: Actor, organizationId: string, input: unknown, stored: { storageKey: string; originalName: string; mimeType: string; sizeBytes: number }) {
  await authorizeOrganization(actor, organizationId, "player_document.upload"); const data = documentMetaSchema.parse(input);
  const player = await db.player.findFirst({ where: { id: data.playerId, organizationId, deletedAt: null } }); if (!player) throw new ApiError(404, "Pemain tidak ditemukan.");
  if (data.registrationId && !await db.playerRegistration.findFirst({ where: { id: data.registrationId, playerId: data.playerId, organizationId } })) throw new ApiError(400, "Registrasi dokumen tidak valid.");
  const replaced = data.replacedDocumentId ? await db.playerDocument.findFirst({ where: { id: data.replacedDocumentId, playerId: data.playerId, organizationId, isCurrent: true } }) : null;
  if (data.replacedDocumentId && !replaced) throw new ApiError(404, "Dokumen pengganti tidak ditemukan.");
  return db.$transaction(async (tx) => {
    if (replaced) await tx.playerDocument.update({ where: { id: replaced.id }, data: { isCurrent: false } });
    const document = await tx.playerDocument.create({ data: { organizationId, ...data, ...stored, uploadedById: actor.id, version: replaced ? replaced.version + 1 : 1 } });
    await audit(tx, actor, organizationId, "CREATE", "PlayerDocument", document.id, null, { playerId: data.playerId, type: data.type, version: document.version, sizeBytes: stored.sizeBytes }); return document;
  });
}

export async function verifyDocument(actor: Actor, organizationId: string, id: string, input: unknown) {
  await authorizeOrganization(actor, organizationId, "player_document.verify"); const data = documentVerificationSchema.parse(input);
  const before = await db.playerDocument.findFirst({ where: { id, organizationId, isCurrent: true } }); if (!before) throw new ApiError(404, "Dokumen tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const document = await tx.playerDocument.update({ where: { id }, data: { verificationStatus: data.status, rejectionNotes: data.status === "REJECTED" ? data.notes : null } });
    await tx.playerDocumentVerification.create({ data: { documentId: id, verifierId: actor.id, status: data.status, notes: data.notes } });
    await audit(tx, actor, organizationId, data.status === "APPROVED" ? "APPROVE" : "REJECT", "PlayerDocument", id, { verificationStatus: before.verificationStatus }, { verificationStatus: data.status }); return document;
  });
}

export async function getDocumentForDownload(actor: Actor, organizationId: string, id: string) {
  await authorizeOrganization(actor, organizationId, "player_document.view"); const document = await db.playerDocument.findFirst({ where: { id, organizationId }, select: { id: true, storageKey: true, originalName: true, mimeType: true } }); if (!document) throw new ApiError(404, "Dokumen tidak ditemukan.");
  await db.auditLog.create({ data: { actorId: actor.id, organizationId, action: "EXPORT", resourceType: "PlayerDocumentAccess", resourceId: id, after: { accessed: true } } }); return document;
}

export { documentVerificationSchema };
