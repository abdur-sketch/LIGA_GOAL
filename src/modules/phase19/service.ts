import { Prisma, type CompetitionFormat } from "@prisma/client";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { db, rootDb } from "@/lib/db";
import { withMembershipDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { commitQuotaInCurrentTransaction, evaluateEntitlement, reserveQuotaInCurrentTransaction } from "@/modules/phase14/service";
import { templateDefinition } from "./catalog";
import { criterionSchema, entrySchema, genericCompetitionSchema, participantSchema, scoreSchema, sessionSchema } from "./validation";
import { assertActiveJudgeAssignment } from "@/modules/phase21/access";
import { submitResultsForApproval } from "@/modules/phase21/service";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function formatForTemplate(code: string): CompetitionFormat {
  if (code === "football") return "SINGLE_ROUND_ROBIN";
  if (code === "esports") return "SINGLE_ELIMINATION";
  if (code === "festival") return "GROUP_AND_KNOCKOUT";
  return "GROUP_STAGE";
}

async function audit(actor: ApiActor, organizationId: string, action: "CREATE" | "UPDATE" | "APPROVE", resourceType: string, resourceId: string, after?: unknown) {
  await db.auditLog.createMany({ data: [{ organizationId, actorId: actor.id, action, resourceType, resourceId, ...(after === undefined ? {} : { after: json(after) }) }] });
}

export async function getOrganizerOrganization(actor: ApiActor) {
  const memberships = await withMembershipDatabase(actor.id, () => db.organizationMember.findMany({
    where: { userId: actor.id, isActive: true, organization: { status: "ACTIVE", deletedAt: null } },
    select: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
    take: 1,
  }));
  return memberships[0]?.organization ?? null;
}

export async function getMultiCompetitionWorkspace(actor: ApiActor, requestedOrganizationId?: string) {
  const organization = await getOrganizerOrganization(actor);
  if (!organization) return null;
  if (requestedOrganizationId && requestedOrganizationId !== organization.id && !actor.isPlatformAdmin) throw new ApiError(403, "Workspace organisasi tidak diizinkan.");
  const organizationId = requestedOrganizationId ?? organization.id;
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "competition.view");
    const [templates, competitions, participants] = await Promise.all([
      db.competitionTemplate.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
      db.competition.findMany({
        where: { organizationId, deletedAt: null },
        include: {
          genericProfile: { include: { template: { select: { code: true, name: true } } } },
          parentCompetition: { select: { id: true, name: true } },
          genericEntries: { where: { status: "APPROVED" }, include: { participant: { select: { id: true, name: true, type: true } } }, orderBy: { createdAt: "asc" } },
          genericSessions: { include: { entries: true }, orderBy: { sequence: "asc" } },
          scoringCriteria: { orderBy: { sortOrder: "asc" } },
          _count: { select: { genericEntries: true, genericSessions: true, branches: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.competitionParticipant.findMany({ where: { organizationId, deletedAt: null }, orderBy: { name: "asc" } }),
    ]);
    return { organization: organizationId === organization.id ? organization : { id: organizationId, name: "Platform workspace", slug: organizationId }, templates, competitions, participants };
  });
}

export async function createGenericCompetition(actor: ApiActor, raw: unknown) {
  const input = genericCompetitionSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "competition.create");
    const definition = templateDefinition(input.templateCode);
    if (!definition) throw new ApiError(422, "Template kompetisi tidak didukung.");
    const [template, parent] = await Promise.all([
      db.competitionTemplate.findFirst({ where: { code: input.templateCode, isActive: true }, orderBy: { version: "desc" } }),
      input.parentCompetitionId ? db.competition.findFirst({ where: { id: input.parentCompetitionId, organizationId: input.organizationId, deletedAt: null }, include: { genericProfile: true } }) : null,
    ]);
    if (!template) throw new ApiError(409, "Template belum tersedia. Jalankan migrasi Phase 19.");
    if (input.parentCompetitionId && !parent) throw new ApiError(422, "Acara induk tidak berada dalam organisasi ini.");
    if (parent && parent.genericProfile?.kind !== "FESTIVAL") throw new ApiError(422, "Hanya Gebyar/Festival yang dapat memiliki cabang lomba.");
    const entitlement = await evaluateEntitlement(input.organizationId, "competition.create");
    if (!entitlement.allowed) throw new ApiError(402, "Paket saat ini tidak mengizinkan pembuatan kompetisi.", entitlement);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase19:${input.organizationId}:${input.idempotencyKey}`}))`;
    const existingEvent = await db.usageEvent.findFirst({ where: { organizationId: input.organizationId, metricKey: "competition.active", eventKey: input.idempotencyKey, kind: "COMMIT" } });
    if (existingEvent?.metadata && typeof existingEvent.metadata === "object" && !Array.isArray(existingEvent.metadata) && "resourceId" in existingEvent.metadata) {
      const resourceId = String(existingEvent.metadata.resourceId);
      const existing = await db.competition.findFirst({ where: { id: resourceId, organizationId: input.organizationId }, include: { genericProfile: true } });
      if (existing) return existing;
    }
    const reservation = await reserveQuotaInCurrentTransaction({
      organizationId: input.organizationId,
      metricKey: "competition.active",
      featureKey: "competition.max_active",
      eventKey: input.idempotencyKey,
      currentUsage: () => db.competition.count({ where: { organizationId: input.organizationId, deletedAt: null, status: { not: "ARCHIVED" } } }),
    });
    if (reservation.duplicate) throw new ApiError(409, "Permintaan pembuatan kompetisi sudah diproses.");
    const competition = await db.competition.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        category: input.category ?? definition.name,
        location: input.location,
        format: formatForTemplate(input.templateCode),
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        parentCompetitionId: input.parentCompetitionId,
        genericProfile: { create: { templateId: template.id, kind: definition.kind, participantMode: definition.participantMode, scoringMethod: definition.scoringMethod, config: json(template.config) } },
        scoringCriteria: definition.suggestedCriteria.length ? { create: definition.suggestedCriteria.map((criterion, index) => ({ organizationId: input.organizationId, ...criterion, sortOrder: index })) } : undefined,
      },
      include: { genericProfile: true, scoringCriteria: true },
    });
    await commitQuotaInCurrentTransaction({ organizationId: input.organizationId, counterId: reservation.counterId, metricKey: "competition.active", eventKey: input.idempotencyKey, resourceId: competition.id });
    await audit(actor, input.organizationId, "CREATE", "GENERIC_COMPETITION", competition.id, { templateCode: input.templateCode, parentCompetitionId: input.parentCompetitionId ?? null });
    return competition;
  });
}

export async function createParticipant(actor: ApiActor, raw: unknown) {
  const input = participantSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "participant.manage");
    const participant = await db.competitionParticipant.create({ data: input });
    await audit(actor, input.organizationId, "CREATE", "COMPETITION_PARTICIPANT", participant.id, { type: participant.type, name: participant.name });
    return participant;
  });
}

export async function registerGenericEntry(actor: ApiActor, raw: unknown) {
  const input = entrySchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "participant.manage");
    const [competition, participant, season] = await Promise.all([
      db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, include: { genericProfile: true } }),
      db.competitionParticipant.findFirst({ where: { id: input.participantId, organizationId: input.organizationId, deletedAt: null, isActive: true } }),
      input.seasonId ? db.season.findFirst({ where: { id: input.seasonId, competitionId: input.competitionId } }) : null,
    ]);
    if (!competition?.genericProfile || !participant || (input.seasonId && !season)) throw new ApiError(422, "Kompetisi, periode, atau peserta tidak valid.");
    if (competition.genericProfile.participantMode === "INDIVIDUAL" && participant.type !== "INDIVIDUAL") throw new ApiError(422, "Kompetisi ini hanya menerima peserta individu.");
    if (competition.genericProfile.participantMode === "TEAM" && participant.type === "INDIVIDUAL") throw new ApiError(422, "Kompetisi ini hanya menerima regu/tim/instansi.");
    const entry = await db.genericCompetitionEntry.create({ data: { ...input, status: "APPROVED", submittedAt: new Date(), approvedAt: new Date() } });
    await audit(actor, input.organizationId, "CREATE", "GENERIC_COMPETITION_ENTRY", entry.id, { competitionId: input.competitionId, participantId: input.participantId });
    return entry;
  });
}

export async function createCompetitionSession(actor: ApiActor, raw: unknown) {
  const input = sessionSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "competition_session.manage");
    const competition = await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, select: { id: true } });
    if (!competition) throw new ApiError(422, "Kompetisi tidak valid.");
    const validEntries = input.entryIds.length ? await db.genericCompetitionEntry.findMany({ where: { id: { in: input.entryIds }, organizationId: input.organizationId, competitionId: input.competitionId, status: "APPROVED" }, select: { id: true } }) : [];
    if (validEntries.length !== new Set(input.entryIds).size) throw new ApiError(422, "Satu atau lebih peserta sesi tidak valid.");
    const session = await db.competitionSession.create({ data: { organizationId: input.organizationId, competitionId: input.competitionId, name: input.name, sequence: input.sequence, startsAt: input.startsAt, endsAt: input.endsAt, status: input.startsAt ? "SCHEDULED" : "DRAFT", entries: validEntries.length ? { create: validEntries.map((entry, index) => ({ entryId: entry.id, order: index + 1 })) } : undefined }, include: { entries: true } });
    await audit(actor, input.organizationId, "CREATE", "COMPETITION_SESSION", session.id, { competitionId: input.competitionId, sequence: input.sequence });
    return session;
  });
}

export async function createScoringCriterion(actor: ApiActor, raw: unknown) {
  const input = criterionSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "generic_scoring.manage");
    const competition = await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, select: { id: true } });
    if (!competition) throw new ApiError(422, "Kompetisi tidak valid.");
    const criterion = await db.scoringCriterion.create({ data: { ...input, sortOrder: await db.scoringCriterion.count({ where: { competitionId: input.competitionId } }) } });
    await audit(actor, input.organizationId, "CREATE", "SCORING_CRITERION", criterion.id, { competitionId: input.competitionId, code: input.code });
    return criterion;
  });
}

export async function publishCompetitionSession(actor: ApiActor, raw: { organizationId: string; competitionId: string; sessionId: string }) {
  return withTenantDatabase(rootDb, raw.organizationId, async () => {
    await authorizeOrganization(actor, raw.organizationId, "competition_session.manage");
    const session = await db.competitionSession.findFirst({ where: { id: raw.sessionId, organizationId: raw.organizationId, competitionId: raw.competitionId }, include: { _count: { select: { entries: true } } } });
    if (!session) throw new ApiError(404, "Sesi tidak ditemukan.");
    if (!session.startsAt || session._count.entries < 1) throw new ApiError(409, "Sesi harus memiliki waktu dan minimal satu peserta sebelum diterbitkan.");
    const updated = await db.competitionSession.update({ where: { id: session.id }, data: { publishedAt: new Date(), status: session.status === "DRAFT" ? "SCHEDULED" : session.status } });
    await audit(actor, raw.organizationId, "APPROVE", "COMPETITION_SESSION_PUBLICATION", session.id, { competitionId: raw.competitionId });
    return updated;
  });
}

export async function recordGenericScore(actor: ApiActor, raw: unknown) {
  const input = scoreSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "generic_scoring.manage");
    const session = await db.competitionSession.findFirst({ where: { id: input.sessionId, organizationId: input.organizationId }, include: { entries: { where: { entryId: input.entryId } } } });
    if (!session || !session.entries.length) throw new ApiError(422, "Peserta tidak terdaftar pada sesi ini.");
    if (!["SCHEDULED", "LIVE"].includes(session.status)) throw new ApiError(409, "Nilai hanya dapat dimasukkan pada sesi terjadwal atau sedang berlangsung.");
    await assertActiveJudgeAssignment(actor.id, input.organizationId, input.sessionId);
    const criterion = input.criterionId ? await db.scoringCriterion.findFirst({ where: { id: input.criterionId, organizationId: input.organizationId, competitionId: session.competitionId } }) : null;
    if (input.criterionId && !criterion) throw new ApiError(422, "Kriteria penilaian tidak valid.");
    if (criterion?.maxScore != null && input.score > criterion.maxScore) throw new ApiError(422, `Nilai melebihi maksimum ${criterion.maxScore}.`);
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase19:score-request:${input.organizationId}:${input.idempotencyKey}`}))`;
    const replay = await db.genericScoreEntry.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (replay) return replay;

    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase19:score:${input.organizationId}:${input.sessionId}:${input.entryId}:${input.criterionId ?? "overall"}:${actor.id}`}))`;
    const correctionReplay = await db.auditLog.findFirst({
      where: { organizationId: input.organizationId, resourceType: "GENERIC_SCORE", actorId: actor.id, after: { path: ["idempotencyKey"], equals: input.idempotencyKey } },
      select: { resourceId: true },
    });
    if (correctionReplay?.resourceId) {
      const previousResponse = await db.genericScoreEntry.findFirst({ where: { id: correctionReplay.resourceId, organizationId: input.organizationId } });
      if (previousResponse) return previousResponse;
    }
    const existing = await db.genericScoreEntry.findFirst({
      where: { organizationId: input.organizationId, sessionId: input.sessionId, entryId: input.entryId, ...(input.criterionId ? { criterionId: input.criterionId } : { criterion: { is: null } }), judgeId: actor.id },
    });
    if (existing && !["DRAFT", "SUBMITTED"].includes(existing.status)) throw new ApiError(409, "Nilai telah dikunci dan hanya dapat diubah setelah hasil dibuka kembali.");
    const score = existing
      ? await db.genericScoreEntry.update({ where: { id: existing.id }, data: { score: input.score, penalty: input.penalty, notes: input.notes, status: "SUBMITTED" } })
      : await db.genericScoreEntry.create({ data: { ...input, judgeId: actor.id, status: "SUBMITTED" } });
    await audit(actor, input.organizationId, existing ? "UPDATE" : "CREATE", "GENERIC_SCORE", score.id, {
      sessionId: input.sessionId,
      entryId: input.entryId,
      criterionId: input.criterionId ?? null,
      idempotencyKey: input.idempotencyKey,
      ...(existing ? { previous: { score: existing.score, penalty: existing.penalty }, current: { score: score.score, penalty: score.penalty } } : {}),
    });
    return score;
  });
}

export async function publishGenericResults(actor: ApiActor, raw: { organizationId: string; competitionId: string; sessionId?: string }) {
  const submitted = await submitResultsForApproval(actor, raw.organizationId, raw.competitionId, raw.sessionId);
  return submitted.ranking;
}
