import { Prisma, type AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ApiError,
  authorizeOrganization,
  capabilities,
  type getApiActor,
} from "@/lib/auth/api";
import {
  distributeGroups,
  generateBracket as buildBracket,
  generateRoundRobin,
  type GeneratedFixture,
} from "./generator";
import { validateSchedule, type ScheduleItem } from "./scheduling";
import {
  automaticDrawSchema,
  bracketSchema,
  cancelSchema,
  fixtureUpdateSchema,
  formatConfigSchema,
  generationSchema,
  groupSchema,
  manualFixtureSchema,
  membershipSchema,
  publicationSchema,
  stageSchema,
} from "./validation";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
export type Phase3Query = {
  organizationId: string;
  search: string;
  status?: string;
  page: number;
  pageSize: number;
  seasonId?: string;
  competitionId?: string;
  stageId?: string;
  groupId?: string;
};
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const meta = (total: number, query: Phase3Query) => ({
  page: query.page,
  pageSize: query.pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
});
async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string,
  before: unknown,
  after: unknown,
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      organizationId,
      action,
      resourceType,
      resourceId,
      before: before == null ? Prisma.JsonNull : json(before),
      after: after == null ? Prisma.JsonNull : json(after),
    },
  });
}

async function scopedSeason(
  organizationId: string,
  seasonId: string,
  competitionId?: string,
) {
  const season = await db.season.findFirst({
    where: {
      id: seasonId,
      ...(competitionId ? { competitionId } : {}),
      competition: { organizationId, deletedAt: null },
    },
    include: { competition: true },
  });
  if (!season)
    throw new ApiError(
      400,
      "Musim atau kompetisi tidak valid untuk organisasi ini.",
    );
  return season;
}
async function approvedClubIds(organizationId: string, seasonId: string) {
  return new Set(
    (
      await db.competitionClub.findMany({
        where: { organizationId, seasonId, status: "APPROVED" },
        select: { clubId: true },
      })
    ).map((item) => item.clubId),
  );
}
async function assertClubsAllowed(
  organizationId: string,
  seasonId: string,
  clubIds: string[],
) {
  const allowed = await approvedClubIds(organizationId, seasonId);
  if (
    new Set(clubIds).size !== clubIds.length ||
    clubIds.some((clubId) => !allowed.has(clubId))
  )
    throw new ApiError(
      422,
      "Semua klub harus unik dan berstatus approved pada musim ini.",
    );
  return allowed;
}
async function assertScheduleResources(
  organizationId: string,
  venueIds: (string | null | undefined)[],
  refereeIds: (string | null | undefined)[],
) {
  const venues = [
    ...new Set(venueIds.filter((value): value is string => Boolean(value))),
  ];
  const referees = [
    ...new Set(refereeIds.filter((value): value is string => Boolean(value))),
  ];
  const [venueCount, refereeCount] = await Promise.all([
    db.venue.count({
      where: { id: { in: venues }, organizationId, deletedAt: null },
    }),
    db.official.count({
      where: { id: { in: referees }, organizationId, deletedAt: null },
    }),
  ]);
  if (venueCount !== venues.length || refereeCount !== referees.length)
    throw new ApiError(
      422,
      "Venue atau wasit tidak valid untuk organisasi ini.",
    );
}
async function fixtureRules(competitionId: string) {
  const record = await db.competitionRule.findUnique({
    where: { competitionId_key: { competitionId, key: "fixture_format" } },
  });
  return formatConfigSchema.parse(record?.value || {});
}

export async function phase3Lookups(actor: Actor, organizationId: string) {
  const access = await capabilities(actor, organizationId, [
    "fixture.view",
    "fixture.generate",
    "fixture.create",
    "fixture.update",
    "fixture.publish",
    "fixture.reschedule",
    "fixture.cancel",
    "group.view",
    "group.manage",
    "bracket.view",
    "bracket.manage",
    "schedule.view",
    "schedule.manage",
  ]);
  if (
    !["fixture.view", "group.view", "bracket.view", "schedule.view"].some(
      (key) => access[key],
    )
  )
    throw new ApiError(403, "Tidak memiliki izin melihat data penjadwalan.");
  const [competitions, seasons, stages, clubs, venues, officials] =
    await Promise.all([
      db.competition.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, name: true, format: true },
        orderBy: { name: "asc" },
      }),
      db.season.findMany({
        where: { competition: { organizationId, deletedAt: null } },
        select: {
          id: true,
          name: true,
          competitionId: true,
          startsAt: true,
          endsAt: true,
        },
        orderBy: { startsAt: "desc" },
      }),
      db.stage.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          seasonId: true,
          type: true,
          format: true,
          publishedAt: true,
        },
        orderBy: [{ seasonId: "asc" }, { sortOrder: "asc" }],
      }),
      db.club.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        select: { id: true, name: true, logoUrl: true },
        orderBy: { name: "asc" },
      }),
      db.venue.findMany({
        where: { organizationId, deletedAt: null, status: "AVAILABLE" },
        select: { id: true, name: true, timezone: true },
        orderBy: { name: "asc" },
      }),
      db.official.findMany({
        where: { organizationId, deletedAt: null, isActive: true },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ]);
  return {
    competitions,
    seasons,
    stages,
    clubs,
    venues,
    officials,
    capabilities: access,
  };
}

export async function getFormatRules(
  actor: Actor,
  organizationId: string,
  competitionId: string,
) {
  await authorizeOrganization(actor, organizationId, "fixture.view");
  const competition = await db.competition.findFirst({
    where: { id: competitionId, organizationId, deletedAt: null },
  });
  if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan.");
  return fixtureRules(competitionId);
}
export async function saveFormatRules(
  actor: Actor,
  organizationId: string,
  competitionId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.update");
  const competition = await db.competition.findFirst({
    where: { id: competitionId, organizationId, deletedAt: null },
  });
  if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan.");
  const rules = formatConfigSchema.parse(input);
  return db.$transaction(async (tx) => {
    const record = await tx.competitionRule.upsert({
      where: { competitionId_key: { competitionId, key: "fixture_format" } },
      update: { value: json(rules) },
      create: { competitionId, key: "fixture_format", value: json(rules) },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "FixtureFormatRules",
      record.id,
      null,
      rules,
    );
    return rules;
  });
}

export async function createStage(
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.create");
  const data = stageSchema.parse(input);
  await scopedSeason(organizationId, data.seasonId);
  return db.$transaction(async (tx) => {
    const stage = await tx.stage.create({
      data: { organizationId, ...data, settings: json(data.settings) },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "CREATE",
      "Stage",
      stage.id,
      null,
      stage,
    );
    return stage;
  });
}

export async function listGroups(actor: Actor, query: Phase3Query) {
  await authorizeOrganization(actor, query.organizationId, "group.view");
  const where: Prisma.GroupWhereInput = {
    organizationId: query.organizationId,
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.search
      ? { name: { contains: query.search, mode: "insensitive" } }
      : {}),
  };
  const [data, total, caps] = await Promise.all([
    db.group.findMany({
      where,
      include: {
        stage: {
          select: {
            id: true,
            name: true,
            publishedAt: true,
            season: {
              select: { name: true, competition: { select: { name: true } } },
            },
          },
        },
        memberships: {
          include: {
            club: { select: { id: true, name: true, logoUrl: true } },
          },
          orderBy: [{ seed: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: { name: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.group.count({ where }),
    capabilities(actor, query.organizationId, ["group.manage"]),
  ]);
  return {
    data,
    meta: meta(total, query),
    capabilities: { manage: caps["group.manage"] },
  };
}
async function scopedGroup(organizationId: string, id: string) {
  const group = await db.group.findFirst({
    where: { id, organizationId },
    include: { stage: true },
  });
  if (!group) throw new ApiError(404, "Grup tidak ditemukan.");
  return group;
}
function requirePublishedConfirmation(
  publishedAt: Date | null,
  confirmed: boolean,
) {
  if (publishedAt && !confirmed)
    throw new ApiError(
      409,
      "Jadwal stage sudah diterbitkan. Konfirmasi perubahan grup diperlukan.",
    );
}
export async function createGroup(
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "group.manage");
  const data = groupSchema.parse(input);
  const stage = await db.stage.findFirst({
    where: { id: data.stageId, organizationId },
  });
  if (!stage) throw new ApiError(400, "Stage tidak valid.");
  requirePublishedConfirmation(stage.publishedAt, data.confirmPublishedChange);
  return db.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: { organizationId, stageId: data.stageId, name: data.name },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "CREATE",
      "Group",
      group.id,
      null,
      group,
    );
    return group;
  });
}
export async function renameGroup(
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "group.manage");
  const data = groupSchema.partial({ stageId: true }).parse(input);
  const before = await scopedGroup(organizationId, id);
  requirePublishedConfirmation(
    before.stage.publishedAt,
    data.confirmPublishedChange ?? false,
  );
  return db.$transaction(async (tx) => {
    const group = await tx.group.update({
      where: { id },
      data: { name: data.name },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "Group",
      id,
      before,
      group,
    );
    return group;
  });
}
export async function assignGroupClub(
  actor: Actor,
  organizationId: string,
  groupId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "group.manage");
  const data = membershipSchema.parse(input);
  const group = await scopedGroup(organizationId, groupId);
  requirePublishedConfirmation(
    group.stage.publishedAt,
    data.confirmPublishedChange,
  );
  await assertClubsAllowed(organizationId, group.stage.seasonId, [data.clubId]);
  return db.$transaction(async (tx) => {
    const membership = await tx.groupMembership.create({
      data: {
        organizationId,
        groupId,
        stageId: group.stageId,
        clubId: data.clubId,
        seed: data.seed,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "CREATE",
      "GroupMembership",
      membership.id,
      null,
      membership,
    );
    return membership;
  });
}
export async function removeGroupClub(
  actor: Actor,
  organizationId: string,
  membershipId: string,
  confirmed = false,
) {
  await authorizeOrganization(actor, organizationId, "group.manage");
  const membership = await db.groupMembership.findFirst({
    where: { id: membershipId, organizationId },
    include: { group: { include: { stage: true } } },
  });
  if (!membership) throw new ApiError(404, "Keanggotaan grup tidak ditemukan.");
  requirePublishedConfirmation(membership.group.stage.publishedAt, confirmed);
  return db.$transaction(async (tx) => {
    await tx.groupMembership.delete({ where: { id: membershipId } });
    await audit(
      tx,
      actor,
      organizationId,
      "DELETE",
      "GroupMembership",
      membershipId,
      membership,
      null,
    );
    return { id: membershipId };
  });
}
export async function automaticGroupDraw(
  actor: Actor,
  organizationId: string,
  stageId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "group.manage");
  const data = automaticDrawSchema.parse(input);
  const stage = await db.stage.findFirst({
    where: { id: stageId, organizationId },
    include: { groups: true },
  });
  if (!stage || !stage.groups.length)
    throw new ApiError(422, "Stage dan grup harus tersedia.");
  requirePublishedConfirmation(stage.publishedAt, data.confirmPublishedChange);
  await assertClubsAllowed(organizationId, stage.seasonId, data.clubIds);
  const draw = distributeGroups(
    data.clubIds,
    stage.groups.map((group) => group.id),
    data.seeded,
  );
  return db.$transaction(async (tx) => {
    await tx.groupMembership.deleteMany({ where: { stageId } });
    await tx.groupMembership.createMany({
      data: draw.map((item) => ({ organizationId, stageId, ...item })),
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "GroupDraw",
      stageId,
      null,
      { memberships: draw },
    );
    return draw;
  });
}

function scheduledDrafts(
  fixtures: GeneratedFixture[],
  start: Date | null | undefined,
  days: number,
  venues: string[],
  referees: string[],
  groupId?: string,
) {
  let number = 0;
  return fixtures.map((fixture, index) => {
    number += 1;
    const sameRoundIndex = fixtures
      .slice(0, index)
      .filter((item) => item.round === fixture.round).length;
    const kickoffAt = start
      ? new Date(
          start.getTime() +
            (fixture.round - 1) * days * 86_400_000 +
            sameRoundIndex * 3 * 3_600_000,
        )
      : null;
    return {
      ...fixture,
      matchNumber: number,
      kickoffAt,
      venueId: venues.length ? venues[index % venues.length] : null,
      refereeId: referees.length ? referees[index % referees.length] : null,
      groupId,
    };
  });
}
export async function generateFixturePreview(
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.generate");
  const data = generationSchema.parse(input);
  await assertScheduleResources(organizationId, data.venueIds, data.refereeIds);
  const existing = await db.fixtureGeneration.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId,
        idempotencyKey: data.idempotencyKey,
      },
    },
    include: {
      drafts: {
        include: { homeClub: true, awayClub: true, venue: true, referee: true },
        orderBy: { matchNumber: "asc" },
      },
    },
  });
  if (existing) return existing;
  const season = await scopedSeason(
    organizationId,
    data.seasonId,
    data.competitionId,
  );
  const stage = await db.stage.findFirst({
    where: { id: data.stageId, organizationId, seasonId: data.seasonId },
  });
  if (!stage) throw new ApiError(400, "Stage tidak valid.");
  const participation = await db.competitionClub.findMany({
    where: { organizationId, seasonId: data.seasonId, status: "APPROVED" },
    select: { clubId: true },
  });
  const clubs = data.clubIds?.length
    ? data.clubIds
    : participation.map((item) => item.clubId);
  await assertClubsAllowed(organizationId, data.seasonId, clubs);
  if (clubs.length < 2)
    throw new ApiError(422, "Minimal dua klub approved diperlukan.");
  let drafts: ReturnType<typeof scheduledDrafts> = [];
  if (
    data.format === "SINGLE_ROUND_ROBIN" ||
    data.format === "DOUBLE_ROUND_ROBIN"
  ) {
    const result = generateRoundRobin(
      clubs,
      data.format === "DOUBLE_ROUND_ROBIN" ? 2 : 1,
    );
    drafts = scheduledDrafts(
      result.fixtures,
      data.kickoffStart,
      data.daysBetweenRounds,
      data.venueIds,
      data.refereeIds,
    );
  } else if (data.format === "GROUP_STAGE" || stage.type === "GROUP") {
    const groups = await db.group.findMany({
      where: { stageId: data.stageId, organizationId },
      include: { memberships: true },
      orderBy: { name: "asc" },
    });
    if (!groups.length)
      throw new ApiError(
        422,
        "Buat dan isi grup sebelum menghasilkan fixture grup.",
      );
    let offset = 0;
    for (const group of groups) {
      const result = generateRoundRobin(
        group.memberships.map((item) => item.clubId),
        data.config.homeAway ? 2 : 1,
      );
      const generated = scheduledDrafts(
        result.fixtures,
        data.kickoffStart,
        data.daysBetweenRounds,
        data.venueIds,
        data.refereeIds,
        group.id,
      ).map((item) => ({ ...item, matchNumber: item.matchNumber + offset }));
      drafts.push(...generated);
      offset = drafts.length;
    }
  } else {
    const bracket = buildBracket(clubs, data.drawMethod === "SEEDED");
    const firstRound = bracket
      .filter((item) => item.round === 1 && item.homeClubId && item.awayClubId)
      .map((item) => ({
        round: 1,
        homeClubId: item.homeClubId!,
        awayClubId: item.awayClubId!,
      }));
    drafts = scheduledDrafts(
      firstRound,
      data.kickoffStart,
      data.daysBetweenRounds,
      data.venueIds,
      data.refereeIds,
    );
  }
  const rules = formatConfigSchema.parse(data.config);
  const previewConflicts = await validateDraftSet(
    organizationId,
    season,
    drafts,
    rules,
  );
  return db.$transaction(
    async (tx) => {
      const generation = await tx.fixtureGeneration.create({
        data: {
          organizationId,
          competitionId: data.competitionId,
          seasonId: data.seasonId,
          stageId: data.stageId,
          idempotencyKey: data.idempotencyKey,
          format: data.format,
          drawMethod: data.drawMethod,
          config: json({
            ...data.config,
            byes: data.format.includes("ROUND_ROBIN")
              ? generateRoundRobin(
                  clubs,
                  data.format === "DOUBLE_ROUND_ROBIN" ? 2 : 1,
                ).byes
              : [],
          }),
          status: "PREVIEW",
          fixtureCount: drafts.length,
          roundCount: Math.max(...drafts.map((item) => item.round), 0),
          warnings: json(previewConflicts),
          createdById: actor.id,
          drafts: {
            create: drafts.map((item) => ({
              organizationId,
              stageId: data.stageId,
              groupId: item.groupId,
              round: item.round,
              matchNumber: item.matchNumber,
              homeClubId: item.homeClubId,
              awayClubId: item.awayClubId,
              venueId: item.venueId,
              refereeId: item.refereeId,
              kickoffAt: item.kickoffAt,
              timezone: rules.timezone,
              warnings: json(
                previewConflicts.filter(
                  (conflict) =>
                    !conflict.itemId ||
                    conflict.itemId === String(item.matchNumber),
                ),
              ),
            })),
          },
        },
        include: {
          drafts: {
            include: {
              homeClub: true,
              awayClub: true,
              venue: true,
              referee: true,
            },
            orderBy: { matchNumber: "asc" },
          },
        },
      });
      await audit(
        tx,
        actor,
        organizationId,
        "CREATE",
        "FixtureGeneration",
        generation.id,
        null,
        { format: data.format, fixtureCount: drafts.length },
      );
      return generation;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function validateDraftSet(
  organizationId: string,
  season: { id: string; startsAt: Date; endsAt: Date },
  drafts: Array<{
    matchNumber: number;
    homeClubId: string;
    awayClubId: string;
    venueId: string | null;
    refereeId: string | null;
    kickoffAt: Date | null;
  }>,
  rules: ReturnType<typeof formatConfigSchema.parse>,
  excludeGenerationId?: string,
  excludeMatchId?: string,
) {
  const registered = await approvedClubIds(organizationId, season.id);
  const matches = await db.match.findMany({
    where: {
      organizationId,
      seasonId: season.id,
      ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
      status: { notIn: ["CANCELLED", "ABANDONED"] },
      ...(excludeGenerationId
        ? { fixtureDraft: { generationId: { not: excludeGenerationId } } }
        : {}),
    },
    include: {
      homeTeam: { select: { clubId: true } },
      awayTeam: { select: { clubId: true } },
      officialAssignments: { where: { role: "REFEREE" }, take: 1 },
    },
  });
  const existing: ScheduleItem[] = matches.map((match) => ({
    id: match.id,
    homeClubId: match.homeTeam.clubId,
    awayClubId: match.awayTeam.clubId,
    venueId: match.venueId,
    refereeId: match.officialAssignments[0]?.officialId,
    kickoffAt: match.kickoffAt,
  }));
  return validateSchedule(
    drafts.map((item) => ({ id: String(item.matchNumber), ...item })),
    {
      seasonStart: season.startsAt,
      seasonEnd: season.endsAt,
      registeredClubIds: registered,
      minimumRestHours: rules.minimumRestHours,
      matchDurationMinutes: rules.matchDurationMinutes,
      existing,
    },
  );
}
async function computeGenerationValidation(
  organizationId: string,
  generationId: string,
) {
  const generation = await db.fixtureGeneration.findFirst({
    where: { id: generationId, organizationId },
    include: { season: true, drafts: true },
  });
  if (!generation) throw new ApiError(404, "Preview fixture tidak ditemukan.");
  const rules = formatConfigSchema.parse(generation.config);
  const conflicts = await validateDraftSet(
    organizationId,
    generation.season,
    generation.drafts,
    rules,
    generation.id,
  );
  return { generation, conflicts };
}
export async function validateGeneration(
  actor: Actor,
  organizationId: string,
  id: string,
) {
  await authorizeOrganization(actor, organizationId, "fixture.generate");
  const { generation, conflicts } = await computeGenerationValidation(
    organizationId,
    id,
  );
  const status = conflicts.some((item) => item.severity === "ERROR")
    ? "PREVIEW"
    : "VALIDATED";
  await db.fixtureGeneration.update({
    where: { id },
    data: { status, warnings: json(conflicts) },
  });
  return { ...generation, status, conflicts };
}
export async function listGenerations(actor: Actor, query: Phase3Query) {
  await authorizeOrganization(actor, query.organizationId, "fixture.view");
  const where: Prisma.FixtureGenerationWhereInput = {
    organizationId: query.organizationId,
    ...(query.seasonId ? { seasonId: query.seasonId } : {}),
    ...(query.status
      ? {
          status:
            query.status as Prisma.EnumFixtureGenerationStatusFilter["equals"],
        }
      : {}),
  };
  const [data, total, caps] = await Promise.all([
    db.fixtureGeneration.findMany({
      where,
      include: {
        competition: { select: { name: true } },
        season: { select: { name: true } },
        stage: { select: { name: true } },
        _count: { select: { drafts: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.fixtureGeneration.count({ where }),
    capabilities(actor, query.organizationId, [
      "fixture.generate",
      "fixture.publish",
    ]),
  ]);
  return { data, meta: meta(total, query), capabilities: caps };
}
export async function getGeneration(
  actor: Actor,
  organizationId: string,
  id: string,
) {
  await authorizeOrganization(actor, organizationId, "fixture.view");
  const generation = await db.fixtureGeneration.findFirst({
    where: { id, organizationId },
    include: {
      competition: { select: { name: true } },
      season: { select: { name: true, startsAt: true, endsAt: true } },
      stage: { select: { name: true } },
      drafts: {
        include: {
          homeClub: { select: { id: true, name: true, logoUrl: true } },
          awayClub: { select: { id: true, name: true, logoUrl: true } },
          venue: { select: { name: true } },
          referee: { select: { fullName: true } },
        },
        orderBy: [{ round: "asc" }, { matchNumber: "asc" }],
      },
      publication: true,
    },
  });
  if (!generation) throw new ApiError(404, "Preview fixture tidak ditemukan.");
  return generation;
}

export async function publishGeneration(
  actor: Actor,
  organizationId: string,
  generationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.publish");
  const payload = publicationSchema.parse(input);
  const idempotent = await db.fixturePublication.findUnique({
    where: {
      organizationId_idempotencyKey: {
        organizationId,
        idempotencyKey: payload.idempotencyKey,
      },
    },
  });
  if (idempotent) return idempotent;
  const { generation, conflicts } = await computeGenerationValidation(
    organizationId,
    generationId,
  );
  if (conflicts.some((item) => item.severity === "ERROR"))
    throw new ApiError(422, "Fixture belum lolos validasi.", conflicts);
  if (generation.status === "PUBLISHED")
    return db.fixturePublication.findUnique({ where: { generationId } });
  return db.$transaction(
    async (tx) => {
      const latest = await tx.match.aggregate({
        where: { seasonId: generation.seasonId },
        _max: { matchNumber: true },
      });
      let matchNumber = latest._max.matchNumber || 0;
      for (const draft of generation.drafts) {
        const [homeTeam, awayTeam] = await Promise.all([
          tx.team.upsert({
            where: {
              competitionId_clubId: {
                competitionId: generation.competitionId,
                clubId: draft.homeClubId,
              },
            },
            update: {},
            create: {
              competitionId: generation.competitionId,
              clubId: draft.homeClubId,
              name: (
                await tx.club.findUniqueOrThrow({
                  where: { id: draft.homeClubId },
                  select: { name: true },
                })
              ).name,
            },
          }),
          tx.team.upsert({
            where: {
              competitionId_clubId: {
                competitionId: generation.competitionId,
                clubId: draft.awayClubId,
              },
            },
            update: {},
            create: {
              competitionId: generation.competitionId,
              clubId: draft.awayClubId,
              name: (
                await tx.club.findUniqueOrThrow({
                  where: { id: draft.awayClubId },
                  select: { name: true },
                })
              ).name,
            },
          }),
        ]);
        matchNumber += 1;
        const match = await tx.match.create({
          data: {
            organizationId,
            competitionId: generation.competitionId,
            seasonId: generation.seasonId,
            stageId: generation.stageId,
            groupId: draft.groupId,
            fixtureDraftId: draft.id,
            venueId: draft.venueId,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id,
            round: draft.round,
            matchNumber,
            kickoffAt: draft.kickoffAt,
            timezone: draft.timezone,
            status: "SCHEDULED",
            createdById: actor.id,
            updatedById: actor.id,
            publishedAt: new Date(),
          },
        });
        if (draft.refereeId)
          await tx.matchOfficialAssignment.create({
            data: {
              organizationId,
              matchId: match.id,
              officialId: draft.refereeId,
              role: "REFEREE",
            },
          });
      }
      const publication = await tx.fixturePublication.create({
        data: {
          organizationId,
          generationId,
          idempotencyKey: payload.idempotencyKey,
          publishedById: actor.id,
          fixtureCount: generation.drafts.length,
        },
      });
      await tx.fixtureGeneration.update({
        where: { id: generationId },
        data: { status: "PUBLISHED", warnings: json([]) },
      });
      await tx.stage.update({
        where: { id: generation.stageId },
        data: { publishedAt: new Date() },
      });
      await audit(
        tx,
        actor,
        organizationId,
        "APPROVE",
        "FixturePublication",
        publication.id,
        null,
        { generationId, fixtureCount: generation.drafts.length },
      );
      return publication;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

const fixtureInclude = {
  homeTeam: {
    include: { club: { select: { id: true, name: true, logoUrl: true } } },
  },
  awayTeam: {
    include: { club: { select: { id: true, name: true, logoUrl: true } } },
  },
  venue: { select: { id: true, name: true, timezone: true } },
  stage: { select: { id: true, name: true } },
  group: { select: { id: true, name: true } },
  officialAssignments: {
    include: { official: { select: { id: true, fullName: true } } },
  },
  scheduleHistory: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { name: true } } },
  },
} satisfies Prisma.MatchInclude;
export async function listFixtures(
  actor: Actor,
  query: Phase3Query,
  permission: "fixture.view" | "schedule.view" = "fixture.view",
) {
  await authorizeOrganization(actor, query.organizationId, permission);
  const where: Prisma.MatchWhereInput = {
    organizationId: query.organizationId,
    ...(query.seasonId ? { seasonId: query.seasonId } : {}),
    ...(query.competitionId ? { competitionId: query.competitionId } : {}),
    ...(query.stageId ? { stageId: query.stageId } : {}),
    ...(query.groupId ? { groupId: query.groupId } : {}),
    ...(query.status
      ? { status: query.status as Prisma.EnumMatchStatusFilter["equals"] }
      : {}),
    ...(query.search
      ? {
          OR: [
            {
              homeTeam: {
                club: { name: { contains: query.search, mode: "insensitive" } },
              },
            },
            {
              awayTeam: {
                club: { name: { contains: query.search, mode: "insensitive" } },
              },
            },
          ],
        }
      : {}),
  };
  const [data, total, caps] = await Promise.all([
    db.match.findMany({
      where,
      include: fixtureInclude,
      orderBy: [{ kickoffAt: "asc" }, { matchNumber: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.match.count({ where }),
    capabilities(actor, query.organizationId, [
      "fixture.create",
      "fixture.update",
      "fixture.publish",
      "fixture.reschedule",
      "fixture.cancel",
      "schedule.manage",
    ]),
  ]);
  return { data, meta: meta(total, query), capabilities: caps };
}
export async function getFixture(
  actor: Actor,
  organizationId: string,
  id: string,
) {
  await authorizeOrganization(actor, organizationId, "fixture.view");
  const fixture = await db.match.findFirst({
    where: { id, organizationId },
    include: fixtureInclude,
  });
  if (!fixture) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  const caps = await capabilities(actor, organizationId, [
    "fixture.update",
    "fixture.publish",
    "fixture.reschedule",
    "fixture.cancel",
  ]);
  return { ...fixture, _capabilities: caps };
}
async function teamsForClubs(
  tx: Prisma.TransactionClient,
  competitionId: string,
  homeClubId: string,
  awayClubId: string,
) {
  const clubs = await tx.club.findMany({
    where: { id: { in: [homeClubId, awayClubId] } },
    select: { id: true, name: true },
  });
  const names = new Map(clubs.map((club) => [club.id, club.name]));
  return Promise.all(
    [homeClubId, awayClubId].map((clubId) =>
      tx.team.upsert({
        where: { competitionId_clubId: { competitionId, clubId } },
        update: {},
        create: { competitionId, clubId, name: names.get(clubId) || clubId },
      }),
    ),
  );
}
export async function createManualFixture(
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.create");
  const data = manualFixtureSchema.parse(input);
  await assertScheduleResources(
    organizationId,
    [data.venueId],
    [data.refereeId],
  );
  const season = await scopedSeason(
    organizationId,
    data.seasonId,
    data.competitionId,
  );
  const stage = await db.stage.findFirst({
    where: { id: data.stageId, organizationId, seasonId: data.seasonId },
  });
  if (!stage) throw new ApiError(400, "Stage tidak valid.");
  if (
    data.groupId &&
    !(await db.group.findFirst({
      where: { id: data.groupId, organizationId, stageId: data.stageId },
    }))
  )
    throw new ApiError(400, "Grup tidak valid untuk stage ini.");
  await assertClubsAllowed(organizationId, data.seasonId, [
    data.homeClubId,
    data.awayClubId,
  ]);
  const rules = await fixtureRules(data.competitionId);
  const conflicts = await validateDraftSet(
    organizationId,
    season,
    [
      {
        matchNumber: 1,
        homeClubId: data.homeClubId,
        awayClubId: data.awayClubId,
        venueId: data.venueId || null,
        refereeId: data.refereeId || null,
        kickoffAt: data.kickoffAt || null,
      },
    ],
    rules,
  );
  const blocking = conflicts.filter(
    (item) => !["KICKOFF_REQUIRED", "VENUE_REQUIRED"].includes(item.code),
  );
  if (blocking.length)
    throw new ApiError(422, "Jadwal manual memiliki konflik.", blocking);
  return db.$transaction(
    async (tx) => {
      const [homeTeam, awayTeam] = await teamsForClubs(
        tx,
        data.competitionId,
        data.homeClubId,
        data.awayClubId,
      );
      const latest = await tx.match.aggregate({
        where: { seasonId: data.seasonId },
        _max: { matchNumber: true },
      });
      const match = await tx.match.create({
        data: {
          organizationId,
          competitionId: data.competitionId,
          seasonId: data.seasonId,
          stageId: data.stageId,
          groupId: data.groupId,
          venueId: data.venueId,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          round: 1,
          matchNumber: (latest._max.matchNumber || 0) + 1,
          kickoffAt: data.kickoffAt,
          timezone: data.timezone,
          status: "DRAFT",
          createdById: actor.id,
          updatedById: actor.id,
        },
      });
      if (data.refereeId)
        await tx.matchOfficialAssignment.create({
          data: {
            organizationId,
            matchId: match.id,
            officialId: data.refereeId,
            role: "REFEREE",
          },
        });
      await audit(
        tx,
        actor,
        organizationId,
        "CREATE",
        "Match",
        match.id,
        null,
        match,
      );
      return match;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
async function mutateSchedule(
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
  permission: "fixture.update" | "fixture.reschedule",
) {
  await authorizeOrganization(actor, organizationId, permission);
  const data = fixtureUpdateSchema.parse(input);
  await assertScheduleResources(
    organizationId,
    [data.venueId],
    [data.refereeId],
  );
  const before = await db.match.findFirst({
    where: { id, organizationId },
    include: {
      homeTeam: true,
      awayTeam: true,
      officialAssignments: { where: { role: "REFEREE" } },
    },
  });
  if (!before) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  const season = await scopedSeason(
    organizationId,
    before.seasonId,
    before.competitionId,
  );
  const rules = await fixtureRules(before.competitionId);
  const refereeId =
    data.refereeId === undefined
      ? before.officialAssignments[0]?.officialId
      : data.refereeId;
  const candidate = {
    matchNumber: before.matchNumber,
    homeClubId: before.homeTeam.clubId,
    awayClubId: before.awayTeam.clubId,
    venueId: data.venueId === undefined ? before.venueId : data.venueId,
    refereeId: refereeId || null,
    kickoffAt: data.kickoffAt === undefined ? before.kickoffAt : data.kickoffAt,
  };
  const conflicts = await validateDraftSet(
    organizationId,
    season,
    [candidate],
    rules,
    undefined,
    id,
  );
  if (conflicts.some((item) => item.severity === "ERROR"))
    throw new ApiError(422, "Perubahan jadwal memiliki konflik.", conflicts);
  return db.$transaction(async (tx) => {
    const updated = await tx.match.update({
      where: { id },
      data: {
        venueId: candidate.venueId,
        kickoffAt: candidate.kickoffAt,
        timezone: data.timezone,
        updatedById: actor.id,
        version: { increment: 1 },
        ...(permission === "fixture.reschedule" ? { status: "SCHEDULED" } : {}),
      },
    });
    if (data.refereeId !== undefined) {
      await tx.matchOfficialAssignment.deleteMany({
        where: { matchId: id, role: "REFEREE" },
      });
      if (data.refereeId)
        await tx.matchOfficialAssignment.create({
          data: {
            organizationId,
            matchId: id,
            officialId: data.refereeId,
            role: "REFEREE",
          },
        });
    }
    const snapshotBefore = {
      venueId: before.venueId,
      kickoffAt: before.kickoffAt,
      refereeId: before.officialAssignments[0]?.officialId,
    };
    const snapshotAfter = {
      venueId: candidate.venueId,
      kickoffAt: candidate.kickoffAt,
      refereeId,
    };
    await tx.matchScheduleHistory.create({
      data: {
        organizationId,
        matchId: id,
        actorId: actor.id,
        action: permission === "fixture.reschedule" ? "RESCHEDULE" : "UPDATE",
        before: json(snapshotBefore),
        after: json(snapshotAfter),
        reason: data.reason,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "Match",
      id,
      snapshotBefore,
      snapshotAfter,
    );
    return updated;
  });
}
export const updateFixture = (
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) => mutateSchedule(actor, organizationId, id, input, "fixture.update");
export const rescheduleFixture = (
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) => mutateSchedule(actor, organizationId, id, input, "fixture.reschedule");
export async function updateFixtureDraft(
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.update");
  const data = fixtureUpdateSchema.parse(input);
  await assertScheduleResources(
    organizationId,
    [data.venueId],
    [data.refereeId],
  );
  const before = await db.fixtureDraft.findFirst({
    where: {
      id,
      organizationId,
      generation: { status: { in: ["DRAFT", "PREVIEW", "VALIDATED"] } },
    },
    include: { generation: { include: { season: true } } },
  });
  if (!before)
    throw new ApiError(
      404,
      "Draft fixture tidak ditemukan atau sudah diterbitkan.",
    );
  const rules = formatConfigSchema.parse(before.generation.config);
  const candidate = {
    matchNumber: before.matchNumber,
    homeClubId: before.homeClubId,
    awayClubId: before.awayClubId,
    venueId: data.venueId === undefined ? before.venueId : data.venueId,
    refereeId: data.refereeId === undefined ? before.refereeId : data.refereeId,
    kickoffAt: data.kickoffAt === undefined ? before.kickoffAt : data.kickoffAt,
  };
  const conflicts = await validateDraftSet(
    organizationId,
    before.generation.season,
    [candidate],
    rules,
    before.generationId,
  );
  return db.$transaction(async (tx) => {
    const draft = await tx.fixtureDraft.update({
      where: { id },
      data: {
        venueId: candidate.venueId,
        refereeId: candidate.refereeId,
        kickoffAt: candidate.kickoffAt,
        timezone: data.timezone,
        warnings: json(conflicts),
      },
    });
    await tx.fixtureGeneration.update({
      where: { id: before.generationId },
      data: { status: "PREVIEW" },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "FixtureDraft",
      id,
      before,
      draft,
    );
    return draft;
  });
}
export async function postponeFixture(
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.reschedule");
  const data = cancelSchema.parse(input);
  const before = await db.match.findFirst({ where: { id, organizationId } });
  if (!before) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: { id },
      data: {
        status: "POSTPONED",
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    await tx.matchScheduleHistory.create({
      data: {
        organizationId,
        matchId: id,
        actorId: actor.id,
        action: "POSTPONE",
        before: json({ status: before.status, kickoffAt: before.kickoffAt }),
        after: json({ status: "POSTPONED", kickoffAt: before.kickoffAt }),
        reason: data.reason,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "Match",
      id,
      { status: before.status },
      { status: "POSTPONED" },
    );
    return match;
  });
}
export async function publishManualFixture(
  actor: Actor,
  organizationId: string,
  id: string,
) {
  await authorizeOrganization(actor, organizationId, "fixture.publish");
  const match = await db.match.findFirst({
    where: { id, organizationId },
    include: {
      homeTeam: true,
      awayTeam: true,
      officialAssignments: { where: { role: "REFEREE" } },
    },
  });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  if (match.publishedAt) return match;
  const season = await scopedSeason(
    organizationId,
    match.seasonId,
    match.competitionId,
  );
  const rules = await fixtureRules(match.competitionId);
  const conflicts = await validateDraftSet(
    organizationId,
    season,
    [
      {
        matchNumber: match.matchNumber,
        homeClubId: match.homeTeam.clubId,
        awayClubId: match.awayTeam.clubId,
        venueId: match.venueId,
        refereeId: match.officialAssignments[0]?.officialId || null,
        kickoffAt: match.kickoffAt,
      },
    ],
    rules,
    undefined,
    id,
  );
  if (conflicts.some((item) => item.severity === "ERROR"))
    throw new ApiError(422, "Fixture manual belum lolos validasi.", conflicts);
  return db.$transaction(async (tx) => {
    const published = await tx.match.update({
      where: { id },
      data: {
        status: "SCHEDULED",
        publishedAt: new Date(),
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    await tx.matchScheduleHistory.create({
      data: {
        organizationId,
        matchId: id,
        actorId: actor.id,
        action: "PUBLISH",
        before: json({ status: match.status, publishedAt: null }),
        after: json({
          status: "SCHEDULED",
          publishedAt: published.publishedAt,
        }),
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "APPROVE",
      "Match",
      id,
      { status: match.status },
      { status: "SCHEDULED" },
    );
    return published;
  });
}
export async function cancelFixture(
  actor: Actor,
  organizationId: string,
  id: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "fixture.cancel");
  const data = cancelSchema.parse(input);
  const before = await db.match.findFirst({ where: { id, organizationId } });
  if (!before) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return db.$transaction(async (tx) => {
    const match = await tx.match.update({
      where: { id },
      data: {
        status: "CANCELLED",
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    await tx.matchScheduleHistory.create({
      data: {
        organizationId,
        matchId: id,
        actorId: actor.id,
        action: "CANCEL",
        before: json({ status: before.status }),
        after: json({ status: "CANCELLED" }),
        reason: data.reason,
      },
    });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      "Match",
      id,
      { status: before.status },
      { status: "CANCELLED" },
    );
    return match;
  });
}

export async function createBracket(
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  await authorizeOrganization(actor, organizationId, "bracket.manage");
  const data = bracketSchema.parse(input);
  const stage = await db.stage.findFirst({
    where: { id: data.stageId, organizationId },
    include: { season: true },
  });
  if (!stage || stage.type !== "KNOCKOUT")
    throw new ApiError(422, "Stage knockout tidak valid.");
  await assertClubsAllowed(organizationId, stage.seasonId, data.clubIds);
  if (await db.bracketTie.count({ where: { stageId: data.stageId } }))
    throw new ApiError(409, "Bracket untuk stage ini sudah dibuat.");
  const nodes = buildBracket(data.clubIds, data.seeded);
  return db.$transaction(
    async (tx) => {
      const ties = new Map<string, string>();
      for (const node of nodes) {
        const tie = await tx.bracketTie.create({
          data: {
            organizationId,
            competitionId: data.competitionId,
            stageId: data.stageId,
            round: node.round,
            position: node.position,
            label: node.label,
            legs: data.legs,
            status: node.homeClubId && node.awayClubId ? "READY" : "PENDING",
          },
        });
        ties.set(`${node.round}:${node.position}`, tie.id);
      }
      for (const node of nodes) {
        const tieId = ties.get(`${node.round}:${node.position}`)!;
        if (node.nextRound)
          await tx.bracketTie.update({
            where: { id: tieId },
            data: {
              nextTieId: ties.get(`${node.nextRound}:${node.nextPosition}`),
              nextSide: node.nextSide,
            },
          });
        const previous = nodes.filter(
          (candidate) =>
            candidate.nextRound === node.round &&
            candidate.nextPosition === node.position,
        );
        await tx.bracketSlot.createMany({
          data: [
            {
              organizationId,
              tieId,
              side: "HOME",
              clubId: node.homeClubId,
              seed: node.homeClubId
                ? data.clubIds.indexOf(node.homeClubId) + 1
                : null,
              sourceTieId: previous[0]
                ? ties.get(`${previous[0].round}:${previous[0].position}`)
                : null,
              sourceLabel: node.homeClubId
                ? null
                : previous[0]
                  ? `Winner ${previous[0].label} ${previous[0].position}`
                  : "BYE",
            },
            {
              organizationId,
              tieId,
              side: "AWAY",
              clubId: node.awayClubId,
              seed: node.awayClubId
                ? data.clubIds.indexOf(node.awayClubId) + 1
                : null,
              sourceTieId: previous[1]
                ? ties.get(`${previous[1].round}:${previous[1].position}`)
                : null,
              sourceLabel: node.awayClubId
                ? null
                : previous[1]
                  ? `Winner ${previous[1].label} ${previous[1].position}`
                  : "BYE",
            },
          ],
        });
      }
      if (data.thirdPlace) {
        const semifinalRound = Math.max(...nodes.map((node) => node.round)) - 1;
        const semifinals = nodes.filter(
          (node) => node.round === semifinalRound,
        );
        if (semifinals.length === 2) {
          const tie = await tx.bracketTie.create({
            data: {
              organizationId,
              competitionId: data.competitionId,
              stageId: data.stageId,
              round: semifinalRound + 1,
              position: 2,
              label: "Third Place",
              legs: 1,
            },
          });
          await tx.bracketSlot.createMany({
            data: [
              {
                organizationId,
                tieId: tie.id,
                side: "HOME",
                sourceTieId: ties.get(
                  `${semifinals[0].round}:${semifinals[0].position}`,
                ),
                sourceLabel: "Loser Semifinal 1",
              },
              {
                organizationId,
                tieId: tie.id,
                side: "AWAY",
                sourceTieId: ties.get(
                  `${semifinals[1].round}:${semifinals[1].position}`,
                ),
                sourceLabel: "Loser Semifinal 2",
              },
            ],
          });
        }
      }
      await audit(
        tx,
        actor,
        organizationId,
        "CREATE",
        "Bracket",
        data.stageId,
        null,
        { tieCount: nodes.length, thirdPlace: data.thirdPlace },
      );
      return { tieCount: nodes.length + (data.thirdPlace ? 1 : 0) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function readBracket(
  actor: Actor,
  organizationId: string,
  stageId: string,
) {
  await authorizeOrganization(actor, organizationId, "bracket.view");
  const stage = await db.stage.findFirst({
    where: { id: stageId, organizationId },
    select: { id: true, name: true },
  });
  if (!stage) throw new ApiError(404, "Stage tidak ditemukan.");
  const ties = await db.bracketTie.findMany({
    where: { organizationId, stageId },
    include: {
      slots: {
        include: { club: { select: { id: true, name: true, logoUrl: true } } },
        orderBy: { side: "asc" },
      },
      match: { include: { venue: { select: { name: true } } } },
    },
    orderBy: [{ round: "asc" }, { position: "asc" }],
  });
  return { stage, ties };
}

export async function listPublicFixtures(organizationId: string) {
  return db.match.findMany({
    where: {
      organizationId,
      publishedAt: { not: null },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    include: {
      homeTeam: {
        include: { club: { select: { name: true, logoUrl: true } } },
      },
      awayTeam: {
        include: { club: { select: { name: true, logoUrl: true } } },
      },
      venue: { select: { name: true } },
      stage: { select: { name: true } },
    },
    orderBy: { kickoffAt: "asc" },
  });
}
