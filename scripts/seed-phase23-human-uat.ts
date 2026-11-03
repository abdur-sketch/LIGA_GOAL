import { hash } from "bcryptjs";
import type { ApiActor } from "@/lib/auth/api";
import { rootDb } from "@/lib/db";
import {
  createCompetitionSession,
  createGenericCompetition,
  createParticipant,
  registerGenericEntry,
} from "@/modules/phase19/service";
import { assignJudge, configurePublicRegistration } from "@/modules/phase21/service";

const templates = [
  { code: "football", label: "Sepak Bola", participantType: "TEAM" as const },
  { code: "lct", label: "LCT", participantType: "TEAM" as const },
  { code: "school", label: "Sekolah", participantType: "INDIVIDUAL" as const },
  { code: "arts", label: "Seni", participantType: "INDIVIDUAL" as const },
  { code: "religious", label: "Keagamaan", participantType: "INDIVIDUAL" as const },
  { code: "festival", label: "Gebyar Festival", participantType: "TEAM" as const },
  { code: "esports", label: "E-Sports", participantType: "TEAM" as const },
  { code: "custom", label: "Custom", participantType: "INDIVIDUAL" as const },
] as const;

function assertSafeTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL wajib diisi.");
  const target = new URL(databaseUrl);
  const database = target.pathname.replace(/^\//, "");
  if (process.env.LIGA_GOAL_ENVIRONMENT !== "test") throw new Error("Seeder hanya boleh berjalan dengan LIGA_GOAL_ENVIRONMENT=test.");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(target.hostname)) throw new Error("Seeder hanya boleh memakai PostgreSQL loopback.");
  if (!/phase23.*human.*uat/i.test(database)) throw new Error("Nama database wajib memuat phase23, human, dan uat.");
}

async function main() {
  assertSafeTarget();
  const password = process.env.PHASE23_UAT_PASSWORD;
  if (!password || password.length < 14) throw new Error("PHASE23_UAT_PASSWORD minimal 14 karakter dan tidak boleh disimpan di repository.");
  const existing = await rootDb.organization.findUnique({ where: { slug: "phase23-human-uat" }, select: { id: true } });
  if (existing) throw new Error("Fixture Phase 23 sudah ada; gunakan database baru agar hasil deterministik.");
  const passwordHash = await hash(password, 10);
  const labels = ["admin", "organizer", "verifier", "judge", "reviewer", "approver", "viewer"] as const;
  const users = Object.fromEntries(await Promise.all(labels.map(async (label) => {
    const user = await rootDb.user.create({ data: { email: `phase23-${label}@portal-lomba.test`, name: `Phase 23 ${label}`, passwordHash, emailVerifiedAt: new Date(), isPlatformAdmin: label === "admin" } });
    return [label, user] as const;
  }))) as Record<(typeof labels)[number], Awaited<ReturnType<typeof rootDb.user.create>>>;
  const organization = await rootDb.organization.create({
    data: {
      name: "Phase 23 Human UAT Organizer",
      slug: "phase23-human-uat",
      status: "ACTIVE",
      ownerId: users.organizer.id,
      contactEmail: users.organizer.email,
      publicProfile: { create: { publicSlug: "phase23-human-uat", displayName: "Phase 23 Human UAT Organizer", status: "PUBLISHED", publishedAt: new Date() } },
    },
  });
  await rootDb.organizationSubscription.create({ data: { organizationId: organization.id, planVersionId: "pv_enterprise_v1", status: "ACTIVE", assignedById: users.admin.id, reason: "PHASE_23_SYNTHETIC_HUMAN_UAT" } });
  await rootDb.platformPermissionGrant.create({ data: { userId: users.admin.id, permission: "platform.operations.view", grantedById: users.admin.id, reason: "PHASE_23_SYNTHETIC_HUMAN_UAT" } });

  const rolePermissions = {
    organizer: ["competition.create", "competition.view", "competition.update", "participant.view", "participant.manage", "competition_session.view", "competition_session.manage", "judge.assignment.view", "judge.assignment.manage", "registration.public.view", "result.workflow.submit"],
    verifier: ["competition.view", "registration.public.view", "registration.public.review"],
    judge: ["competition.view", "competition_session.view", "generic_scoring.view", "generic_scoring.manage", "judge.assignment.view"],
    reviewer: ["competition.view", "result.workflow.view", "result.workflow.review"],
    approver: ["competition.view", "result.workflow.view", "result.workflow.approve", "result.workflow.publish", "result.workflow.reopen"],
    viewer: ["competition.view", "participant.view", "competition_session.view", "generic_scoring.view", "result.workflow.view"],
  } as const;
  const allKeys = [...new Set(Object.values(rolePermissions).flat())];
  await Promise.all(allKeys.map((key) => rootDb.permission.upsert({ where: { key }, update: {}, create: { key, description: `Phase 23 UAT permission: ${key}` } })));
  const permissions = await rootDb.permission.findMany({ where: { key: { in: allKeys } } });
  for (const [label, keys] of Object.entries(rolePermissions)) {
    const role = await rootDb.role.create({ data: { organizationId: organization.id, name: `Phase 23 ${label}`, key: `phase23-${label}`, permissions: { create: permissions.filter((permission) => (keys as readonly string[]).includes(permission.key)).map((permission) => ({ permissionId: permission.id })) } } });
    const user = users[label as keyof typeof rolePermissions];
    await rootDb.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, roleId: role.id } });
  }

  const organizerActor: ApiActor = { id: users.organizer.id, isActive: true, isPlatformAdmin: false, deletedAt: null };
  let festivalId: string | undefined;
  const seeded = [];
  for (const [index, template] of templates.entries()) {
    const marker = `phase23-${template.code}`;
    const competition = await createGenericCompetition(organizerActor, {
      organizationId: organization.id,
      templateCode: template.code,
      name: `UAT ${template.label}`,
      slug: marker,
      startsAt: new Date(Date.now() + (index + 1) * 86_400_000),
      endsAt: new Date(Date.now() + (index + 2) * 86_400_000),
      parentCompetitionId: template.code === "custom" ? festivalId : undefined,
      idempotencyKey: `phase23-uat-competition-${template.code}`,
    });
    if (template.code === "festival") festivalId = competition.id;
    const participants = await Promise.all([1, 2].map((number) => createParticipant(organizerActor, {
      organizationId: organization.id,
      type: template.participantType,
      name: `${template.label} Peserta ${number}`,
      slug: `${marker}-peserta-${number}`,
      institution: `Instansi Sintetis ${number}`,
      contactEmail: `${marker}-peserta-${number}@test.invalid`,
    })));
    const entries = await Promise.all(participants.map((participant, participantIndex) => registerGenericEntry(organizerActor, {
      organizationId: organization.id,
      competitionId: competition.id,
      participantId: participant.id,
      idempotencyKey: `phase23-uat-entry-${template.code}-${participantIndex + 1}`,
    })));
    const session = await createCompetitionSession(organizerActor, {
      organizationId: organization.id,
      competitionId: competition.id,
      name: "Babak Human UAT",
      sequence: 1,
      startsAt: new Date(Date.now() + (index + 1) * 86_400_000),
      entryIds: entries.map((entry) => entry.id),
    });
    await configurePublicRegistration(organizerActor, { organizationId: organization.id, competitionId: competition.id, enabled: true, quota: 50, requirements: [] });
    await assignJudge(organizerActor, { organizationId: organization.id, competitionId: competition.id, sessionId: session.id, judgeId: users.judge.id, idempotencyKey: `phase23-uat-judge-${template.code}` });
    await rootDb.competitionPublication.create({ data: { organizationId: organization.id, competitionId: competition.id, publicSlug: marker, status: "PUBLISHED", publishedAt: new Date() } });
    seeded.push({ template: template.label, competitionId: competition.id, sessionId: session.id, publicSlug: marker });
  }
  console.log(JSON.stringify({ database: new URL(process.env.DATABASE_URL!).pathname.slice(1), syntheticOnly: true, organizationId: organization.id, accounts: labels.map((label) => ({ role: label, email: users[label].email })), competitions: seeded }, null, 2));
  await rootDb.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Phase 23 UAT seed failed.");
  await rootDb.$disconnect();
  process.exitCode = 1;
});
