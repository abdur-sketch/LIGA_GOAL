import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Prisma, type ResultWorkflowStatus } from "@prisma/client";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { activeDatabaseTransaction, db, rootDb } from "@/lib/db";
import { getEffectivePermissions } from "@/lib/auth/permissions";
import { withPublicDatabase, withRegistrationDatabase, withTenantDatabase } from "@/lib/tenant-db";
import { genericLabels } from "@/modules/phase19/catalog";
import { calculateRanking } from "@/modules/phase19/scoring";
import { assertActiveJudgeAssignment } from "./access";
import { judgeAssignmentSchema, publicRegistrationSchema, registrationConfigSchema, registrationDocumentSchema, registrationReviewSchema, registrationStatusSchema, resultWorkflowSchema } from "./validation";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function audit(actorId: string | null, organizationId: string, action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "DELETE", resourceType: string, resourceId: string, after?: unknown) {
  await db.auditLog.createMany({ data: [{ organizationId, actorId, action, resourceType, resourceId, ...(after === undefined ? {} : { after: json(after) }) }] });
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function registrationSecret() {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32) throw new Error("NEXTAUTH_SECRET diperlukan untuk token pendaftaran.");
  return value;
}

function deterministicToken(input: { publicSlug: string; email: string; idempotencyKey: string }) {
  return createHmac("sha256", registrationSecret()).update(`${input.publicSlug}:${input.email}:${input.idempotencyKey}`).digest("base64url");
}

export async function configurePublicRegistration(actor: ApiActor, raw: unknown) {
  const input = registrationConfigSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "competition.update");
    const competition = await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, include: { genericProfile: true, publication: true } });
    if (!competition?.genericProfile) throw new ApiError(404, "Kompetisi multi-lomba tidak ditemukan.");
    if (input.enabled && !competition.publication && !input.publicSlug) throw new ApiError(422, "Slug publik wajib diisi saat pendaftaran pertama kali diaktifkan.");
    const profile = await db.competitionProfile.update({
      where: { competitionId: competition.id },
      data: { publicRegistrationEnabled: input.enabled, registrationOpensAt: input.opensAt, registrationClosesAt: input.closesAt, registrationQuota: input.quota, registrationRequirements: input.requirements },
    });
    if (input.enabled) {
      const publishedAt = new Date();
      await db.competitionPublication.upsert({
        where: { competitionId: competition.id },
        update: { ...(input.publicSlug ? { publicSlug: input.publicSlug } : {}), status: "PUBLISHED", publishedAt },
        create: { organizationId: input.organizationId, competitionId: competition.id, publicSlug: input.publicSlug!, status: "PUBLISHED", publishedAt },
      });
      if (competition.status === "DRAFT") await db.competition.update({ where: { id: competition.id }, data: { status: "REGISTRATION" } });
    }
    await audit(actor.id, input.organizationId, "UPDATE", "PUBLIC_REGISTRATION_CONFIG", competition.id, input);
    const publication = await db.competitionPublication.findUnique({ where: { competitionId: competition.id }, select: { publicSlug: true, status: true } });
    return { ...profile, publication };
  });
}

function registrationDocuments(value: Prisma.JsonValue) {
  const parsed = registrationDocumentSchema.array().max(10).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function getPublicRegistrationReviewDetail(actor: ApiActor, organizationId: string, registrationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "registration.public.view");
    const registration = await db.publicRegistration.findFirst({
      where: { id: registrationId, organizationId },
      select: {
        id: true, registrationNumber: true, status: true, participantName: true, participantType: true, institution: true,
        contactEmail: true, contactPhone: true, teamData: true, formData: true, documents: true, privacyVersion: true,
        processingConsentAt: true, processingContext: true, isMinor: true, guardianName: true, guardianContact: true,
        guardianConsentAt: true, retentionUntil: true, submittedAt: true, reviewedAt: true, revisionReason: true,
        rejectionReason: true, competition: { select: { id: true, name: true, genericProfile: { select: { registrationRequirements: true } } } },
        history: { select: { action: true, fromStatus: true, toStatus: true, reason: true, createdAt: true, actor: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!registration) throw new ApiError(404, "Pendaftaran tidak ditemukan.");
    const documents = registrationDocuments(registration.documents).map((document, index) => ({ index, originalName: document.originalName, mimeType: document.mimeType, sizeBytes: document.sizeBytes }));
    await db.sensitiveDataAccessLog.create({ data: { organizationId, actorId: actor.id, resourceType: "PublicRegistration", resourceId: registration.id, purpose: "Registration administration verification", fieldSet: ["contactEmail", "contactPhone", "teamData", "formData", "documents", "guardianData"] } });
    return { ...registration, documents };
  });
}

export async function getPublicRegistrationDocument(actor: ApiActor, organizationId: string, registrationId: string, documentIndex: number) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "registration.public.view");
    const registration = await db.publicRegistration.findFirst({ where: { id: registrationId, organizationId }, select: { id: true, documents: true } });
    if (!registration) throw new ApiError(404, "Pendaftaran tidak ditemukan.");
    const document = registrationDocuments(registration.documents)[documentIndex];
    if (!document) throw new ApiError(404, "Dokumen pendaftaran tidak ditemukan.");
    await db.sensitiveDataAccessLog.create({ data: { organizationId, actorId: actor.id, resourceType: "PublicRegistrationDocument", resourceId: registration.id, purpose: "Registration document verification", fieldSet: ["documents"] } });
    return document;
  });
}

export async function assignJudge(actor: ApiActor, raw: unknown) {
  const input = judgeAssignmentSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "judge.assignment.manage");
    const [competition, session, stage, permissions] = await Promise.all([
      db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, select: { id: true } }),
      input.sessionId ? db.competitionSession.findFirst({ where: { id: input.sessionId, competitionId: input.competitionId, organizationId: input.organizationId }, select: { id: true } }) : null,
      input.stageId ? db.stage.findFirst({ where: { id: input.stageId, organizationId: input.organizationId, season: { competitionId: input.competitionId } }, select: { id: true } }) : null,
      getEffectivePermissions(input.judgeId, input.organizationId),
    ]);
    if (!competition || (input.sessionId && !session) || (input.stageId && !stage)) throw new ApiError(422, "Scope penugasan juri tidak valid.");
    if (!permissions.has("generic_scoring.manage") || !permissions.has("judge.assignment.view")) throw new ApiError(422, "Anggota belum memiliki role juri yang sesuai.");
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase21:judge:${input.organizationId}:${input.idempotencyKey}`}))`;
    const existing = await db.judgeAssignment.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey } } });
    if (existing) return existing;
    const assignment = await db.judgeAssignment.create({
      data: { ...input, assignedById: actor.id, status: input.conflictDeclared ? "INACTIVE" : "ACTIVE", validFrom: input.validFrom ?? new Date() },
    });
    await audit(actor.id, input.organizationId, "CREATE", "JUDGE_ASSIGNMENT", assignment.id, { judgeId: input.judgeId, competitionId: input.competitionId, sessionId: input.sessionId ?? null, conflictDeclared: input.conflictDeclared });
    return assignment;
  });
}

export async function revokeJudgeAssignment(actor: ApiActor, organizationId: string, assignmentId: string, reason: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "judge.assignment.manage");
    const result = await db.judgeAssignment.updateMany({ where: { id: assignmentId, organizationId, status: { in: ["ACTIVE", "INACTIVE"] } }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: actor.id, revokeReason: reason } });
    if (result.count !== 1) throw new ApiError(404, "Penugasan aktif tidak ditemukan.");
    await audit(actor.id, organizationId, "DELETE", "JUDGE_ASSIGNMENT", assignmentId, { reason });
    return { id: assignmentId, status: "REVOKED" as const };
  });
}

export async function resolvePublicRegistrationTarget(publicSlug: string) {
  const operation = async () => db.competitionPublication.findFirst({
    where: { publicSlug, status: "PUBLISHED", competition: { status: "REGISTRATION", deletedAt: null, genericProfile: { publicRegistrationEnabled: true } } },
    select: { organizationId: true, competitionId: true, competition: { select: { name: true, genericProfile: { select: { kind: true, participantMode: true, registrationRequirements: true } } } } },
  });
  const target = activeDatabaseTransaction() ? await operation() : await withPublicDatabase(operation);
  if (!target?.competition.genericProfile) throw new ApiError(404, "Pendaftaran lomba tidak tersedia.");
  return target;
}

type SubmissionRow = { id: string; organizationId: string; competitionId: string; registrationNumber: string; status: string };

export async function submitPublicRegistration(raw: unknown) {
  const input = publicRegistrationSchema.parse(raw);
  if (input.website) throw new ApiError(202, "Pendaftaran diterima untuk diproses.");
  const target = await resolvePublicRegistrationTarget(input.publicSlug);
  const requirements = Array.isArray(target.competition.genericProfile?.registrationRequirements) ? target.competition.genericProfile.registrationRequirements : [];
  if (requirements.length > 0 && input.documents.length === 0) throw new ApiError(422, "Dokumen persyaratan wajib diunggah.");
  const token = deterministicToken({ publicSlug: input.publicSlug, email: input.contactEmail, idempotencyKey: input.idempotencyKey });
  const tokenHash = hash(token);
  const registrationNumber = `PL-${createHmac("sha256", registrationSecret()).update(`number:${input.publicSlug}:${input.contactEmail}:${input.idempotencyKey}`).digest("hex").slice(0, 12).toUpperCase()}`;
  const id = randomUUID();
  const historyId = randomUUID();
  const dedupeKey = hash(`${input.contactEmail}:${input.participantName.trim().toLowerCase()}:${input.participantType}`);
  try {
    const rows = await db.$queryRaw<SubmissionRow[]>(Prisma.sql`
      SELECT * FROM public.phase22_submit_public_registration(
        ${id}, ${historyId}, ${input.publicSlug}, ${input.participantType}::"ParticipantType", ${registrationNumber},
        ${input.participantName}, ${input.institution ?? null}, ${input.contactEmail}, ${input.contactPhone ?? null},
        ${JSON.stringify(input.teamData)}::jsonb, ${JSON.stringify(input.formData)}::jsonb, ${JSON.stringify(input.documents)}::jsonb,
        ${tokenHash}, ${input.idempotencyKey}, ${dedupeKey}, ${input.privacyVersion}, ${JSON.stringify(input.processingContext)}::jsonb,
        ${input.isMinor}, ${input.guardianName ?? null}, ${input.guardianContact ?? null}
      )
    `);
    if (!rows[0]) throw new Error("Public registration function returned no row.");
    return { registrationNumber: rows[0].registrationNumber, token, status: "SUBMITTED" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("REGISTRATION_CLOSED")) throw new ApiError(409, "Pendaftaran belum dibuka atau sudah ditutup.");
    if (message.includes("REGISTRATION_QUOTA_FULL")) throw new ApiError(409, "Kuota pendaftaran sudah penuh.");
    if (message.includes("PARTICIPANT_MODE_MISMATCH")) throw new ApiError(422, "Jenis peserta tidak sesuai dengan lomba.");
    if (message.includes("PRIVACY_CONSENT_REQUIRED")) throw new ApiError(422, "Persetujuan pemrosesan data wajib dicatat.");
    if (message.includes("GUARDIAN_CONSENT_REQUIRED")) throw new ApiError(422, "Peserta anak memerlukan persetujuan wali.");
    if (message.includes("unique constraint") || message.includes("duplicate key")) throw new ApiError(409, "Pendaftaran yang sama sudah diterima.");
    throw error;
  }
}

export async function publicRegistrationStatus(raw: unknown) {
  const input = registrationStatusSchema.parse(raw);
  const tokenHash = hash(input.token);
  return withRegistrationDatabase(tokenHash, async () => {
    const registration = await db.publicRegistration.findFirst({
      where: { registrationNumber: input.registrationNumber, tokenHash },
      select: { registrationNumber: true, status: true, participantName: true, submittedAt: true, reviewedAt: true, revisionReason: true, rejectionReason: true, competition: { select: { name: true, publication: { select: { publicSlug: true } } } }, history: { select: { action: true, toStatus: true, reason: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!registration) throw new ApiError(404, "Status pendaftaran tidak ditemukan.");
    return registration;
  });
}

function participantSlug(name: string, registrationNumber: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || "peserta";
  return `${base}-${registrationNumber.slice(-6).toLowerCase()}`;
}

export async function reviewPublicRegistration(actor: ApiActor, raw: unknown) {
  const input = registrationReviewSchema.parse(raw);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "registration.public.review");
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase21:registration:${input.registrationId}`}))`;
    const registration = await db.publicRegistration.findFirst({ where: { id: input.registrationId, organizationId: input.organizationId }, include: { competition: { include: { genericProfile: true } } } });
    if (!registration) throw new ApiError(404, "Pendaftaran tidak ditemukan.");
    const fromStatus = registration.status;
    if (input.action === "start-review") {
      if (!(["SUBMITTED", "REVISION_REQUESTED"] as const).includes(fromStatus as "SUBMITTED" | "REVISION_REQUESTED")) throw new ApiError(409, "Pendaftaran tidak dapat direview pada status ini.");
      await db.publicRegistration.update({ where: { id: registration.id }, data: { status: "UNDER_REVIEW", reviewedById: actor.id, reviewedAt: new Date() } });
      await db.publicRegistrationHistory.create({ data: { organizationId: input.organizationId, registrationId: registration.id, actorId: actor.id, action: "START_REVIEW", fromStatus, toStatus: "UNDER_REVIEW" } });
    } else if (input.action === "request-revision") {
      if (fromStatus !== "UNDER_REVIEW") throw new ApiError(409, "Pendaftaran belum dalam review.");
      await db.publicRegistration.update({ where: { id: registration.id }, data: { status: "REVISION_REQUESTED", revisionReason: input.reason } });
      await db.publicRegistrationHistory.create({ data: { organizationId: input.organizationId, registrationId: registration.id, actorId: actor.id, action: "REQUEST_REVISION", fromStatus, toStatus: "REVISION_REQUESTED", reason: input.reason } });
    } else if (input.action === "reject") {
      if (!(["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"] as const).includes(fromStatus as "SUBMITTED" | "UNDER_REVIEW" | "REVISION_REQUESTED")) throw new ApiError(409, "Pendaftaran tidak dapat ditolak pada status ini.");
      await db.publicRegistration.update({ where: { id: registration.id }, data: { status: "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: input.reason } });
      await db.publicRegistrationHistory.create({ data: { organizationId: input.organizationId, registrationId: registration.id, actorId: actor.id, action: "REJECT", fromStatus, toStatus: "REJECTED", reason: input.reason } });
    } else {
      if (!(["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"] as const).includes(fromStatus as "SUBMITTED" | "UNDER_REVIEW" | "REVISION_REQUESTED")) throw new ApiError(409, "Pendaftaran tidak dapat disetujui pada status ini.");
      const participant = await db.competitionParticipant.create({ data: { organizationId: input.organizationId, type: registration.participantType, name: registration.participantName, slug: participantSlug(registration.participantName, registration.registrationNumber), institution: registration.institution, contactEmail: registration.contactEmail, contactPhone: registration.contactPhone, metadata: json(registration.teamData) } });
      const entry = await db.genericCompetitionEntry.create({ data: { organizationId: input.organizationId, competitionId: registration.competitionId, participantId: participant.id, status: "APPROVED", registrationData: json(registration.formData), idempotencyKey: `public-registration:${registration.id}`, submittedAt: registration.submittedAt, approvedAt: new Date() } });
      await db.publicRegistration.update({ where: { id: registration.id }, data: { status: "APPROVED", reviewedById: actor.id, reviewedAt: new Date(), approvedParticipantId: participant.id, approvedEntryId: entry.id } });
      await db.publicRegistrationHistory.create({ data: { organizationId: input.organizationId, registrationId: registration.id, actorId: actor.id, action: "APPROVE", fromStatus, toStatus: "APPROVED", metadata: { participantId: participant.id, entryId: entry.id } } });
    }
    await audit(actor.id, input.organizationId, input.action === "reject" ? "REJECT" : input.action === "approve" ? "APPROVE" : "UPDATE", "PUBLIC_REGISTRATION", registration.id, { action: input.action, reason: input.reason ?? null });
    return db.publicRegistration.findUniqueOrThrow({ where: { id: registration.id }, select: { id: true, registrationNumber: true, status: true, reviewedAt: true } });
  });
}

async function workflowHistory(workflowId: string, organizationId: string, actorId: string, fromStatus: ResultWorkflowStatus | null, toStatus: ResultWorkflowStatus, action: string, reason?: string, snapshot?: unknown) {
  await db.resultApprovalHistory.create({ data: { organizationId, workflowId, actorId, fromStatus, toStatus, action, reason, ...(snapshot === undefined ? {} : { snapshot: json(snapshot) }) } });
}

export async function submitResultsForApproval(actor: ApiActor, organizationId: string, competitionId: string, sessionId?: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "result.workflow.submit");
    if (!sessionId) throw new ApiError(422, "Sesi wajib dipilih untuk workflow hasil.");
    await assertActiveJudgeAssignment(actor.id, organizationId, sessionId);
    const session = await db.competitionSession.findFirst({ where: { id: sessionId, organizationId, competitionId }, select: { id: true, entries: { select: { entryId: true } } } });
    if (!session) throw new ApiError(404, "Sesi tidak ditemukan.");
    const scores = await db.genericScoreEntry.findMany({ where: { organizationId, sessionId, status: { in: ["SUBMITTED", "VERIFIED"] } }, include: { criterion: { select: { weight: true } } } });
    if (!scores.length) throw new ApiError(409, "Belum ada nilai yang dapat diajukan.");
    const scoredEntryIds = new Set(scores.map((score) => score.entryId));
    if (session.entries.some((entry) => !scoredEntryIds.has(entry.entryId))) throw new ApiError(409, "Semua peserta sesi harus memiliki nilai sebelum hasil diajukan.");
    const ranking = calculateRanking(scores.map((score) => ({ entryId: score.entryId, score: score.score, penalty: score.penalty, weight: score.criterion?.weight })));
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase21:workflow:${organizationId}:${competitionId}:${sessionId}`}))`;
    const existing = await db.resultApprovalWorkflow.findUnique({ where: { competitionId_scopeKey: { competitionId, scopeKey: sessionId } } });
    if (existing && !["DRAFT", "REOPENED"].includes(existing.status)) throw new ApiError(409, "Workflow hasil sudah diajukan.");
    await db.$executeRaw`SELECT set_config('app.allow_result_workflow_write','true',true)`;
    await db.genericResult.deleteMany({ where: { organizationId, competitionId, sessionId, status: { not: "PUBLISHED" } } });
    for (const result of ranking) {
      await db.genericResult.upsert({
        where: { competitionId_scopeKey_entryId: { competitionId, scopeKey: sessionId, entryId: result.entryId } },
        update: { rank: result.rank, totalScore: result.totalScore, status: "SUBMITTED", publishedAt: null },
        create: { organizationId, competitionId, sessionId, scopeKey: sessionId, entryId: result.entryId, rank: result.rank, totalScore: result.totalScore, status: "SUBMITTED" },
      });
    }
    const workflow = existing
      ? await db.resultApprovalWorkflow.update({ where: { id: existing.id }, data: { status: "SUBMITTED", submittedById: actor.id, submittedAt: new Date(), reviewedById: null, reviewedAt: null, approvedById: null, approvedAt: null, publishedById: null, publishedAt: null, lockedAt: null } })
      : await db.resultApprovalWorkflow.create({ data: { organizationId, competitionId, sessionId, scopeKey: sessionId, status: "SUBMITTED", submittedById: actor.id, submittedAt: new Date() } });
    await workflowHistory(workflow.id, organizationId, actor.id, existing?.status ?? null, "SUBMITTED", "SUBMIT", undefined, { ranking });
    await audit(actor.id, organizationId, "CREATE", "RESULT_APPROVAL_WORKFLOW", workflow.id, { competitionId, sessionId, entries: ranking.length });
    return { workflow, ranking };
  });
}

export async function transitionResultWorkflow(actor: ApiActor, raw: unknown) {
  const input = resultWorkflowSchema.parse(raw);
  if (input.action === "submit") return submitResultsForApproval(actor, input.organizationId, input.competitionId, input.sessionId);
  return withTenantDatabase(rootDb, input.organizationId, async () => {
    const permission = input.action === "review" ? "result.workflow.review" : input.action === "approve" ? "result.workflow.approve" : input.action === "publish" ? "result.workflow.publish" : "result.workflow.reopen";
    await authorizeOrganization(actor, input.organizationId, permission);
    const scopeKey = input.sessionId ?? "competition";
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`phase21:workflow:${input.organizationId}:${input.competitionId}:${scopeKey}`}))`;
    const workflow = await db.resultApprovalWorkflow.findFirst({ where: { organizationId: input.organizationId, competitionId: input.competitionId, scopeKey } });
    if (!workflow) throw new ApiError(404, "Workflow hasil tidak ditemukan.");
    const fromStatus = workflow.status;
    let updated;
    if (input.action === "review") {
      if (workflow.status !== "SUBMITTED") throw new ApiError(409, "Hasil belum diajukan.");
      if (workflow.submittedById === actor.id) throw new ApiError(409, "Penilai tidak boleh mereview hasil yang diajukannya sendiri.");
      updated = await db.resultApprovalWorkflow.update({ where: { id: workflow.id }, data: { status: "REVIEWED", reviewedById: actor.id, reviewedAt: new Date(), reviewNotes: input.reason } });
    } else if (input.action === "approve") {
      if (workflow.status !== "REVIEWED") throw new ApiError(409, "Hasil belum direview.");
      if (workflow.submittedById === actor.id) throw new ApiError(409, "Penilai tidak boleh menyetujui hasil miliknya sendiri.");
      updated = await db.resultApprovalWorkflow.update({ where: { id: workflow.id }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), lockedAt: new Date() } });
      await db.$executeRaw`SELECT set_config('app.allow_result_workflow_write','true',true)`;
      await db.genericScoreEntry.updateMany({ where: { organizationId: input.organizationId, sessionId: workflow.sessionId ?? undefined, status: { in: ["SUBMITTED", "VERIFIED"] } }, data: { status: "VERIFIED" } });
      await db.genericResult.updateMany({ where: { organizationId: input.organizationId, competitionId: input.competitionId, scopeKey }, data: { status: "VERIFIED" } });
    } else if (input.action === "publish") {
      if (workflow.status !== "APPROVED" || !workflow.reviewedById || !workflow.approvedById || workflow.submittedById === workflow.approvedById) throw new ApiError(409, "Hasil belum memenuhi dual approval.");
      const now = new Date();
      await db.$executeRaw`SELECT set_config('app.allow_result_workflow_write','true',true)`;
      await db.genericResult.updateMany({ where: { organizationId: input.organizationId, competitionId: input.competitionId, scopeKey, status: "VERIFIED" }, data: { status: "PUBLISHED", publishedAt: now } });
      if (workflow.sessionId) await db.competitionSession.update({ where: { id: workflow.sessionId }, data: { status: "COMPLETED", publishedAt: now } });
      updated = await db.resultApprovalWorkflow.update({ where: { id: workflow.id }, data: { status: "PUBLISHED", publishedById: actor.id, publishedAt: now } });
    } else {
      if (!(["APPROVED", "PUBLISHED"] as const).includes(workflow.status as "APPROVED" | "PUBLISHED")) throw new ApiError(409, "Hanya hasil terkunci yang dapat dibuka kembali.");
      await db.$executeRaw`SELECT set_config('app.allow_result_workflow_write','true',true)`;
      await db.genericResult.updateMany({ where: { organizationId: input.organizationId, competitionId: input.competitionId, scopeKey }, data: { status: "DRAFT", publishedAt: null } });
      if (workflow.sessionId) await db.genericScoreEntry.updateMany({ where: { organizationId: input.organizationId, sessionId: workflow.sessionId, status: { in: ["VERIFIED", "PUBLISHED"] } }, data: { status: "SUBMITTED" } });
      updated = await db.resultApprovalWorkflow.update({ where: { id: workflow.id }, data: { status: "REOPENED", version: { increment: 1 }, reopenedById: actor.id, reopenedAt: new Date(), reopenReason: input.reason, reviewedById: null, reviewedAt: null, approvedById: null, approvedAt: null, publishedById: null, publishedAt: null, lockedAt: null } });
    }
    await workflowHistory(workflow.id, input.organizationId, actor.id, fromStatus, updated.status, input.action.toUpperCase(), input.reason);
    await audit(actor.id, input.organizationId, input.action === "approve" || input.action === "publish" ? "APPROVE" : "UPDATE", "RESULT_APPROVAL_WORKFLOW", workflow.id, { fromStatus, toStatus: updated.status, reason: input.reason ?? null });
    return updated;
  });
}

export async function getOrganizerOperations(actor: ApiActor, organizationId: string) {
  return withTenantDatabase(rootDb, organizationId, async () => {
    await authorizeOrganization(actor, organizationId, "competition.view");
    const permissions = await getEffectivePermissions(actor.id, organizationId);
    const now = new Date();
    const [competitions, participants, pendingRegistrations, liveSessions, incompleteScores, pendingResults, publishedResults, assignments, registrations, workflows, members, audits, competitionOptions] = await Promise.all([
      db.competition.count({ where: { organizationId, deletedAt: null, status: { in: ["REGISTRATION", "ONGOING"] } } }),
      db.competitionParticipant.count({ where: { organizationId, deletedAt: null, isActive: true } }),
      db.publicRegistration.count({ where: { organizationId, status: { in: ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"] } } }),
      db.competitionSession.count({ where: { organizationId, status: "LIVE" } }),
      db.genericScoreEntry.count({ where: { organizationId, status: { in: ["DRAFT", "SUBMITTED"] } } }),
      db.resultApprovalWorkflow.count({ where: { organizationId, status: { in: ["SUBMITTED", "REVIEWED", "APPROVED"] } } }),
      db.resultApprovalWorkflow.count({ where: { organizationId, status: "PUBLISHED" } }),
      db.judgeAssignment.findMany({ where: { organizationId }, select: { id: true, status: true, validFrom: true, validUntil: true, conflictDeclared: true, judge: { select: { id: true, name: true } }, competition: { select: { id: true, name: true } }, session: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
      permissions.has("registration.public.view") ? db.publicRegistration.findMany({ where: { organizationId }, select: { id: true, registrationNumber: true, status: true, participantName: true, participantType: true, institution: true, submittedAt: true, reviewedAt: true, competition: { select: { id: true, name: true } } }, orderBy: { submittedAt: "desc" }, take: 100 }) : Promise.resolve([]),
      db.resultApprovalWorkflow.findMany({ where: { organizationId }, select: { id: true, status: true, version: true, updatedAt: true, competition: { select: { id: true, name: true } }, session: { select: { id: true, name: true } }, submittedBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, approvedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 50 }),
      db.organizationMember.findMany({ where: { organizationId, isActive: true }, select: { user: { select: { id: true, name: true, email: true } }, role: { select: { key: true, name: true } } }, orderBy: { createdAt: "asc" } }),
      db.auditLog.findMany({ where: { organizationId, resourceType: { in: ["JUDGE_ASSIGNMENT", "PUBLIC_REGISTRATION", "RESULT_APPROVAL_WORKFLOW", "GENERIC_SCORE"] } }, select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
      db.competition.findMany({ where: { organizationId, deletedAt: null, genericProfile: { isNot: null } }, select: { id: true, name: true, publication: { select: { publicSlug: true, status: true } }, genericProfile: { select: { publicRegistrationEnabled: true, registrationOpensAt: true, registrationClosesAt: true, registrationQuota: true } }, genericSessions: { select: { id: true, name: true, status: true }, orderBy: { sequence: "asc" } } }, orderBy: { createdAt: "desc" } }),
    ]);
    const securityWarnings = [
      ...assignments.filter((item) => item.conflictDeclared).map((item) => `Konflik kepentingan: ${item.judge.name}`),
      ...assignments.filter((item) => item.status === "ACTIVE" && item.validUntil && item.validUntil <= now).map((item) => `Penugasan kedaluwarsa: ${item.judge.name}`),
    ];
    if (registrations.length && permissions.has("registration.public.view")) {
      await db.sensitiveDataAccessLog.create({ data: { organizationId, actorId: actor.id, resourceType: "PublicRegistrationQueue", purpose: "Organizer registration verification queue", fieldSet: ["participantName", "participantType", "institution", "status"] } });
    }
    return { metrics: { competitions, participants, pendingRegistrations, liveSessions, incompleteScores, pendingResults, publishedResults, activeJudges: assignments.filter((item) => item.status === "ACTIVE" && (!item.validUntil || item.validUntil > now)).length }, assignments, registrations, workflows, members, audits, competitionOptions, securityWarnings, capabilities: Object.fromEntries(["judge.assignment.manage", "registration.public.view", "registration.public.review", "result.workflow.review", "result.workflow.approve", "result.workflow.publish", "result.workflow.reopen"].map((key) => [key, permissions.has(key)])) };
  });
}

export async function listPublicRegistrationCompetitions() {
  const operation = () => db.competitionPublication.findMany({
    where: { status: "PUBLISHED", competition: { status: "REGISTRATION", deletedAt: null, genericProfile: { publicRegistrationEnabled: true } } },
    select: { publicSlug: true, competition: { select: { name: true, description: true, genericProfile: { select: { kind: true, participantMode: true, registrationOpensAt: true, registrationClosesAt: true, registrationQuota: true, registrationRequirements: true } } } } },
    orderBy: { publishedAt: "desc" },
  });
  const rows = activeDatabaseTransaction() ? await operation() : await withPublicDatabase(operation);
  return rows.map((row) => ({ publicSlug: row.publicSlug, name: row.competition.name, description: row.competition.description, ...row.competition.genericProfile, labels: row.competition.genericProfile ? genericLabels(row.competition.genericProfile.kind) : null }));
}

export function randomIdempotencyKey() {
  return randomBytes(18).toString("base64url");
}
