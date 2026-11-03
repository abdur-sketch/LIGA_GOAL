import { randomUUID } from "node:crypto";
import type { ApiActor } from "@/lib/auth/api";
import { rootDb } from "@/lib/db";
import { listPublicGenericResults } from "@/modules/phase19/public";
import { recordGenericScore } from "@/modules/phase19/service";
import {
  reviewPublicRegistration,
  submitPublicRegistration,
  submitResultsForApproval,
  transitionResultWorkflow,
} from "@/modules/phase21/service";

type Measurement = {
  operation: string;
  concurrency: number;
  requests: number;
  failures: number;
  failureRate: number;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  elapsedMs: number;
  rssBytes: number;
  databaseConnections: number;
  maxDatabaseConnections: number;
  databaseSizeBytes: number;
};

function assertIsolatedTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL wajib diisi.");
  const target = new URL(databaseUrl);
  const database = target.pathname.replace(/^\//, "");
  if (process.env.LIGA_GOAL_ENVIRONMENT !== "test") throw new Error("Load test hanya boleh berjalan dengan LIGA_GOAL_ENVIRONMENT=test.");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(target.hostname)) throw new Error("Load test hanya boleh memakai PostgreSQL loopback.");
  if (!/phase23.*load.*test/i.test(database)) throw new Error("Nama database load test wajib memuat phase23, load, dan test.");
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.ceil(values.length * percentileValue) - 1)];
}

async function measure(operation: string, tasks: Array<() => Promise<unknown>>): Promise<Measurement> {
  const latencies: number[] = [];
  let failures = 0;
  const started = performance.now();
  await Promise.all(tasks.map(async (task) => {
    const taskStarted = performance.now();
    try {
      await task();
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - taskStarted);
    }
  }));
  const elapsedMs = performance.now() - started;
  latencies.sort((left, right) => left - right);
  const capacity = await rootDb.$queryRaw<Array<{ connections: bigint; max_connections: number; size_bytes: bigint }>>`
    SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database()) AS connections,
      current_setting('max_connections')::int AS max_connections,
      pg_database_size(current_database()) AS size_bytes
  `;
  return {
    operation,
    concurrency: tasks.length,
    requests: tasks.length,
    failures,
    failureRate: Number((failures / Math.max(tasks.length, 1)).toFixed(4)),
    rps: Number((tasks.length / Math.max(elapsedMs / 1_000, 0.001)).toFixed(2)),
    p50Ms: Number(percentile(latencies, 0.5).toFixed(2)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
    p99Ms: Number(percentile(latencies, 0.99).toFixed(2)),
    elapsedMs: Number(elapsedMs.toFixed(2)),
    rssBytes: process.memoryUsage().rss,
    databaseConnections: Number(capacity[0]?.connections ?? 0),
    maxDatabaseConnections: capacity[0]?.max_connections ?? 0,
    databaseSizeBytes: Number(capacity[0]?.size_bytes ?? 0),
  };
}

async function main() {
assertIsolatedTestDatabase();
process.env.NEXTAUTH_SECRET ||= "portal-lomba-phase23-load-test-secret-000000000000";

const suffix = randomUUID().slice(0, 8);
const registrationCount = Number(process.env.PHASE23_REGISTRATION_COUNT || 40);
const workflowCount = Number(process.env.PHASE23_WORKFLOW_COUNT || 20);
const publicReadCount = Number(process.env.PHASE23_PUBLIC_READ_COUNT || 100);
if (![registrationCount, workflowCount, publicReadCount].every((value) => Number.isInteger(value) && value > 0 && value <= 250)) {
  throw new Error("Jumlah operasi wajib integer 1–250.");
}

const users = await Promise.all(["organizer", "reviewer", "approver"].map((label) => rootDb.user.create({
  data: {
    email: `phase23-${label}-${suffix}@test.invalid`,
    name: `Phase23 ${label}`,
    passwordHash: "synthetic-load-test-only",
    emailVerifiedAt: new Date(),
  },
})));
const [organizer, reviewer, approver] = users;
const organization = await rootDb.organization.create({
  data: {
    name: "Phase 23 Synthetic Load Organizer",
    slug: `phase23-load-${suffix}`,
    status: "ACTIVE",
    ownerId: organizer.id,
    contactEmail: organizer.email,
    publicProfile: {
      create: {
        publicSlug: `phase23-load-organizer-${suffix}`,
        displayName: "Phase 23 Synthetic Load Organizer",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    },
  },
});

const permissionKeys = [
  "generic_scoring.manage",
  "judge.assignment.view",
  "registration.public.review",
  "result.workflow.submit",
  "result.workflow.review",
  "result.workflow.approve",
  "result.workflow.publish",
];
await Promise.all(permissionKeys.map((key) => rootDb.permission.upsert({
  where: { key },
  update: {},
  create: { key, description: `Phase 23 load permission: ${key}` },
})));
const permissions = await rootDb.permission.findMany({ where: { key: { in: permissionKeys } } });
const role = async (label: string, keys: string[]) => rootDb.role.create({
  data: {
    organizationId: organization.id,
    name: `Phase23 ${label}`,
    key: `phase23-${label.toLowerCase()}-${suffix}`,
    permissions: { create: permissions.filter((permission) => keys.includes(permission.key)).map((permission) => ({ permissionId: permission.id })) },
  },
});
const [organizerRole, reviewerRole, approverRole] = await Promise.all([
  role("Organizer", ["generic_scoring.manage", "judge.assignment.view", "registration.public.review", "result.workflow.submit"]),
  role("Reviewer", ["result.workflow.review"]),
  role("Approver", ["result.workflow.approve", "result.workflow.publish"]),
]);
await rootDb.organizationMember.createMany({
  data: [
    { organizationId: organization.id, userId: organizer.id, roleId: organizerRole.id },
    { organizationId: organization.id, userId: reviewer.id, roleId: reviewerRole.id },
    { organizationId: organization.id, userId: approver.id, roleId: approverRole.id },
  ],
});

const competition = await rootDb.competition.create({
  data: {
    organizationId: organization.id,
    name: "Phase 23 Load Competition",
    slug: `phase23-load-competition-${suffix}`,
    format: "GROUP_STAGE",
    status: "REGISTRATION",
    genericProfile: {
      create: {
        kind: "QUIZ",
        participantMode: "BOTH",
        scoringMethod: "POINTS",
        publicRegistrationEnabled: true,
        registrationQuota: registrationCount + 10,
      },
    },
    publication: {
      create: {
        organizationId: organization.id,
        publicSlug: `phase23-load-public-${suffix}`,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    },
  },
});
const publicSlug = `phase23-load-public-${suffix}`;
const actor = (userId: string): ApiActor => ({ id: userId, isActive: true, isPlatformAdmin: false, deletedAt: null });
const privacy = {
  privacyAccepted: true as const,
  privacyVersion: "phase22-draft-2026-11-01" as const,
  processingContext: { source: "phase23-synthetic-load-test" },
  isMinor: false,
  guardianConsent: false,
};

const registrationResults: Array<Awaited<ReturnType<typeof submitPublicRegistration>> | undefined> = new Array(registrationCount);
const measurements: Measurement[] = [];
measurements.push(await measure("public-registration", Array.from({ length: registrationCount }, (_, index) => async () => {
  registrationResults[index] = await submitPublicRegistration({
    publicSlug,
    participantType: index % 2 ? "TEAM" : "INDIVIDUAL",
    participantName: `Synthetic Participant ${suffix}-${index}`,
    institution: "Synthetic Institution",
    contactEmail: `phase23-participant-${suffix}-${index}@test.invalid`,
    contactPhone: `0800${String(index).padStart(6, "0")}`,
    teamData: {},
    formData: { synthetic: true },
    documents: [],
    idempotencyKey: `phase23-registration-${suffix}-${index}`,
    ...privacy,
  });
})));

const registrations = await rootDb.publicRegistration.findMany({
  where: { organizationId: organization.id, competitionId: competition.id },
  orderBy: { createdAt: "asc" },
});
measurements.push(await measure("participant-verification", registrations.map((registration) => () => reviewPublicRegistration(actor(organizer.id), {
  organizationId: organization.id,
  registrationId: registration.id,
  action: "approve",
}))));

const criterion = await rootDb.scoringCriterion.create({
  data: {
    organizationId: organization.id,
    competitionId: competition.id,
    name: "Synthetic Score",
    code: `P23-${suffix}`,
    maxScore: 100,
  },
});
const workflowFixtures = [];
for (let index = 0; index < workflowCount; index += 1) {
  const participant = await rootDb.competitionParticipant.create({
    data: {
      organizationId: organization.id,
      type: "INDIVIDUAL",
      name: `Workflow Participant ${suffix}-${index}`,
      slug: `workflow-participant-${suffix}-${index}`,
    },
  });
  const entry = await rootDb.genericCompetitionEntry.create({
    data: {
      organizationId: organization.id,
      competitionId: competition.id,
      participantId: participant.id,
      status: "APPROVED",
      idempotencyKey: `phase23-workflow-entry-${suffix}-${index}`,
      submittedAt: new Date(),
      approvedAt: new Date(),
    },
  });
  const session = await rootDb.competitionSession.create({
    data: {
      organizationId: organization.id,
      competitionId: competition.id,
      name: `Workflow Session ${index + 1}`,
      sequence: index + 1,
      status: "LIVE",
      entries: { create: { entryId: entry.id, order: 1 } },
    },
  });
  await rootDb.judgeAssignment.create({
    data: {
      organizationId: organization.id,
      competitionId: competition.id,
      sessionId: session.id,
      judgeId: organizer.id,
      assignedById: organizer.id,
      idempotencyKey: `phase23-judge-${suffix}-${index}`,
    },
  });
  workflowFixtures.push({ entryId: entry.id, sessionId: session.id, index });
}

measurements.push(await measure("score-input", workflowFixtures.map((fixture) => () => recordGenericScore(actor(organizer.id), {
  organizationId: organization.id,
  sessionId: fixture.sessionId,
  entryId: fixture.entryId,
  criterionId: criterion.id,
  score: 80 + (fixture.index % 20),
  idempotencyKey: `phase23-score-${suffix}-${fixture.index}`,
}))));

await Promise.all(workflowFixtures.map((fixture) => submitResultsForApproval(actor(organizer.id), organization.id, competition.id, fixture.sessionId)));
await Promise.all(workflowFixtures.map((fixture) => transitionResultWorkflow(actor(reviewer.id), {
  organizationId: organization.id,
  competitionId: competition.id,
  sessionId: fixture.sessionId,
  action: "review",
  reason: "Synthetic load review",
})));
measurements.push(await measure("result-approval", workflowFixtures.map((fixture) => () => transitionResultWorkflow(actor(approver.id), {
  organizationId: organization.id,
  competitionId: competition.id,
  sessionId: fixture.sessionId,
  action: "approve",
  reason: "Synthetic load approval",
}))));
measurements.push(await measure("result-publication", workflowFixtures.map((fixture) => () => transitionResultWorkflow(actor(approver.id), {
  organizationId: organization.id,
  competitionId: competition.id,
  sessionId: fixture.sessionId,
  action: "publish",
}))));
measurements.push(await measure("public-result-access", Array.from({ length: publicReadCount }, () => () => listPublicGenericResults())));

const finalState = {
  registrations: await rootDb.publicRegistration.count({ where: { organizationId: organization.id } }),
  approvedRegistrations: await rootDb.publicRegistration.count({ where: { organizationId: organization.id, status: "APPROVED" } }),
  scores: await rootDb.genericScoreEntry.count({ where: { organizationId: organization.id } }),
  publishedWorkflows: await rootDb.resultApprovalWorkflow.count({ where: { organizationId: organization.id, status: "PUBLISHED" } }),
  publishedResults: await rootDb.genericResult.count({ where: { organizationId: organization.id, status: "PUBLISHED" } }),
};
const failures = measurements.reduce((total, measurement) => total + measurement.failures, 0);
console.log(JSON.stringify({
  environment: "local-isolated",
  syntheticDataOnly: true,
  acceptanceTarget: "NOT_SET_OWNER_APPROVAL_REQUIRED",
  configuration: { registrationCount, workflowCount, publicReadCount },
  measurements,
  finalState,
  failures,
}, null, 2));
await rootDb.$disconnect();
if (failures > 0) process.exitCode = 1;
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Phase 23 load test failed.");
  await rootDb.$disconnect();
  process.exitCode = 1;
});
