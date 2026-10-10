import { Prisma, type AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import {
  ApiError,
  authorizeOrganization,
  capabilities,
  type getApiActor,
} from "@/lib/auth/api";
import type { PermissionKey } from "@/lib/auth/permissions";
import { schemas, type ResourceName } from "./validation";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
type Query = {
  organizationId?: string;
  search: string;
  status?: string;
  page: number;
  pageSize: number;
};

const permissionMap: Record<
  Exclude<
    ResourceName,
    "organizations" | "memberships" | "participations" | "assignments"
  >,
  {
    view: PermissionKey;
    create: PermissionKey;
    update: PermissionKey;
    delete: PermissionKey;
  }
> = {
  competitions: {
    view: "competition.view",
    create: "competition.create",
    update: "competition.update",
    delete: "competition.delete",
  },
  seasons: {
    view: "season.view",
    create: "season.create",
    update: "season.update",
    delete: "season.delete",
  },
  clubs: {
    view: "club.view",
    create: "club.create",
    update: "club.update",
    delete: "club.update",
  },
  venues: {
    view: "venue.view",
    create: "venue.create",
    update: "venue.update",
    delete: "venue.delete",
  },
  officials: {
    view: "official.view",
    create: "official.create",
    update: "official.update",
    delete: "official.delete",
  },
};

const ownerPermissionKeys: PermissionKey[] = [
  "organization.view",
  "organization.update",
  "organization.manage_members",
  "competition.view",
  "competition.create",
  "competition.update",
  "competition.delete",
  "season.view",
  "season.create",
  "season.update",
  "season.delete",
  "club.view",
  "club.create",
  "club.update",
  "club.verify",
  "venue.view",
  "venue.create",
  "venue.update",
  "venue.delete",
  "official.view",
  "official.create",
  "official.update",
  "official.delete",
  "player.view",
  "player.create",
  "player.update",
  "player.archive",
  "registration.view",
  "registration.create",
  "registration.submit",
  "registration.verify",
  "registration.approve",
  "registration.reject",
  "squad.view",
  "squad.manage",
  "player_document.view",
  "player_document.upload",
  "player_document.verify",
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
  "match.view",
  "match.lineup.manage",
  "match.lineup.confirm",
  "match.operate",
  "match.event.correct",
  "match.finish",
  "match.review",
  "match.approve",
  "match.official.correct",
  "match.realtime.publish",
  "standings.view",
  "standings.recompute",
  "standings.adjust",
  "statistics.view",
  "statistics.recompute",
  "statistics.export",
  "leaderboard.view",
  "transfer.view",
  "transfer.request",
  "transfer.review",
  "transfer.approve",
  "transfer.cancel",
  "transfer_window.view",
  "transfer_window.manage",
  "availability.view",
  "availability.manage",
  "injury.view",
  "injury.manage",
  "injury.clearance",
  "discipline.view",
  "discipline.manage",
  "discipline.approve",
  "discipline.appeal",
  "suspension.view",
  "suspension.manage",
  "article.view",
  "article.create",
  "article.update",
  "article.publish",
  "article.archive",
  "notification.view",
  "notification.manage",
  "notification.send",
  "report.view",
  "report.export",
  "audit.view",
  "user.manage",
  "permission.manage",
];

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string | null,
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

function pageResult<T>(data: T[], total: number, query: Query) {
  return {
    data,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}

async function assertTenantRelations(
  resource: ResourceName,
  organizationId: string,
  data: Record<string, unknown>,
) {
  if (resource === "seasons") {
    const competition = await db.competition.findFirst({
      where: {
        id: String(data.competitionId),
        organizationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!competition)
      throw new ApiError(
        400,
        "Kompetisi tidak ditemukan pada organisasi aktif.",
      );
  }
  if (resource === "clubs" && data.homeVenueId) {
    const venue = await db.venue.findFirst({
      where: { id: String(data.homeVenueId), organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!venue)
      throw new ApiError(
        400,
        "Venue kandang tidak berada pada organisasi ini.",
      );
  }
  if (resource === "participations") {
    const [competition, season, club] = await Promise.all([
      db.competition.findFirst({
        where: {
          id: String(data.competitionId),
          organizationId,
          deletedAt: null,
        },
      }),
      db.season.findFirst({
        where: {
          id: String(data.seasonId),
          competition: { organizationId, deletedAt: null },
        },
      }),
      db.club.findFirst({
        where: { id: String(data.clubId), organizationId, deletedAt: null },
      }),
    ]);
    if (
      !competition ||
      !season ||
      !club ||
      season.competitionId !== competition.id
    )
      throw new ApiError(
        400,
        "Kompetisi, musim, dan klub harus berasal dari organisasi yang sama.",
      );
  }
  if (resource === "assignments") {
    const [official, season, club] = await Promise.all([
      db.official.findFirst({
        where: { id: String(data.officialId), organizationId, deletedAt: null },
      }),
      db.season.findFirst({
        where: {
          id: String(data.seasonId),
          competition: { organizationId, deletedAt: null },
        },
      }),
      data.clubId
        ? db.club.findFirst({
            where: { id: String(data.clubId), organizationId, deletedAt: null },
          })
        : Promise.resolve(true),
    ]);
    if (!official || !season || !club)
      throw new ApiError(
        400,
        "Ofisial, musim, dan klub harus berasal dari organisasi yang sama.",
      );
  }
}

export async function listOrganizations(actor: Actor, query: Query) {
  const where: Prisma.OrganizationWhereInput = {
    deletedAt: null,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { slug: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(query.status
      ? {
          status: query.status as Prisma.EnumOrganizationStatusFilter["equals"],
        }
      : {}),
    ...(actor.isPlatformAdmin
      ? {}
      : { memberships: { some: { userId: actor.id, isActive: true } } }),
  };
  const [data, total] = await Promise.all([
    db.organization.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: { memberships: true, competitions: true, clubs: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    db.organization.count({ where }),
  ]);
  const visible = await Promise.all(
    data.map(async (organization) => ({
      ...organization,
      _canUpdate:
        actor.isPlatformAdmin ||
        (await capabilities(actor, organization.id, ["organization.update"]))[
          "organization.update"
        ],
    })),
  );
  return {
    ...pageResult(visible, total, query),
    capabilities: { create: actor.isPlatformAdmin },
  };
}

export async function createOrganization(actor: Actor, input: unknown) {
  if (!actor.isPlatformAdmin)
    throw new ApiError(403, "Hanya Super Admin yang dapat membuat organisasi.");
  const data = schemas.organizations.parse(input);
  const ownerId = data.ownerId || actor.id;
  const owner = await db.user.findFirst({
    where: { id: ownerId, isActive: true, deletedAt: null },
  });
  if (!owner) throw new ApiError(400, "Owner organisasi tidak valid.");
  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { ...data, ownerId },
    });
    const permissions = await Promise.all(
      ownerPermissionKeys.map((key) =>
        tx.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: key },
        }),
      ),
    );
    const role = await tx.role.create({
      data: {
        organizationId: organization.id,
        name: "Organization Owner",
        key: "organization-owner",
        isSystem: true,
        permissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
    });
    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: ownerId,
        roleId: role.id,
      },
    });
    await audit(
      tx,
      actor,
      organization.id,
      "CREATE",
      "Organization",
      organization.id,
      null,
      organization,
    );
    return organization;
  });
}

export async function listResource(
  resource: Exclude<ResourceName, "organizations">,
  actor: Actor,
  query: Query,
) {
  if (!query.organizationId)
    throw new ApiError(400, "organizationId wajib diisi.");
  const organizationId = query.organizationId;
  const permissions =
    resource === "memberships"
      ? ({
          view: "organization.view",
          create: "organization.manage_members",
          update: "organization.manage_members",
          delete: "organization.manage_members",
        } as const)
      : resource === "participations"
        ? ({
            view: "competition.view",
            create: "competition.update",
            update: "competition.update",
            delete: "competition.update",
          } as const)
        : resource === "assignments"
          ? ({
              view: "official.view",
              create: "official.update",
              update: "official.update",
              delete: "official.update",
            } as const)
          : permissionMap[resource];
  await authorizeOrganization(actor, organizationId, permissions.view);
  const common = {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
  let data: unknown[] = [];
  let total = 0;
  if (resource === "memberships") {
    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId,
      ...(query.search
        ? {
            OR: [
              {
                user: { name: { contains: query.search, mode: "insensitive" } },
              },
              {
                user: {
                  email: { contains: query.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    [data, total] = await Promise.all([
      db.organizationMember.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          role: { select: { id: true, name: true, key: true } },
        },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.organizationMember.count({ where }),
    ]);
  } else if (resource === "competitions") {
    const where: Prisma.CompetitionWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { category: { contains: query.search, mode: "insensitive" } },
              { location: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.status
        ? {
            status:
              query.status as Prisma.EnumCompetitionStatusFilter["equals"],
          }
        : {}),
    };
    [data, total] = await Promise.all([
      db.competition.findMany({
        where,
        include: { _count: { select: { seasons: true, clubEntries: true } } },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.competition.count({ where }),
    ]);
  } else if (resource === "seasons") {
    const where: Prisma.SeasonWhereInput = {
      competition: { organizationId, deletedAt: null },
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" } }
        : {}),
      ...(query.status
        ? { status: query.status as Prisma.EnumSeasonStatusFilter["equals"] }
        : {}),
    };
    [data, total] = await Promise.all([
      db.season.findMany({
        where,
        include: {
          competition: { select: { id: true, name: true } },
          _count: { select: { clubEntries: true, stages: true } },
        },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.season.count({ where }),
    ]);
  } else if (resource === "clubs") {
    const where: Prisma.ClubWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { shortName: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    [data, total] = await Promise.all([
      db.club.findMany({
        where,
        include: {
          homeVenue: { select: { id: true, name: true } },
          _count: { select: { competitionEntries: true } },
        },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.club.count({ where }),
    ]);
  } else if (resource === "venues") {
    const where: Prisma.VenueWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { city: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.status
        ? { status: query.status as Prisma.EnumVenueStatusFilter["equals"] }
        : {}),
    };
    [data, total] = await Promise.all([
      db.venue.findMany({
        where,
        include: { _count: { select: { matches: true, homeClubs: true } } },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.venue.count({ where }),
    ]);
  } else if (resource === "officials") {
    const where: Prisma.OfficialWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    [data, total] = await Promise.all([
      db.official.findMany({
        where,
        include: { _count: { select: { assignments: true } } },
        orderBy: { createdAt: "desc" },
        ...common,
      }),
      db.official.count({ where }),
    ]);
  } else if (resource === "participations") {
    const where: Prisma.CompetitionClubWhereInput = {
      organizationId,
      ...(query.status
        ? {
            status:
              query.status as Prisma.EnumParticipationStatusFilter["equals"],
          }
        : {}),
      ...(query.search
        ? { club: { name: { contains: query.search, mode: "insensitive" } } }
        : {}),
    };
    [data, total] = await Promise.all([
      db.competitionClub.findMany({
        where,
        include: {
          competition: { select: { id: true, name: true } },
          season: { select: { id: true, name: true } },
          club: { select: { id: true, name: true, shortName: true } },
        },
        orderBy: { registeredAt: "desc" },
        ...common,
      }),
      db.competitionClub.count({ where }),
    ]);
  } else {
    const where: Prisma.OfficialAssignmentWhereInput = {
      official: { organizationId, deletedAt: null },
      ...(query.search
        ? {
            official: {
              organizationId,
              deletedAt: null,
              fullName: { contains: query.search, mode: "insensitive" },
            },
          }
        : {}),
    };
    [data, total] = await Promise.all([
      db.officialAssignment.findMany({
        where,
        include: {
          official: { select: { id: true, fullName: true } },
          season: {
            select: {
              id: true,
              name: true,
              competition: { select: { name: true } },
            },
          },
          club: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: "desc" },
        ...common,
      }),
      db.officialAssignment.count({ where }),
    ]);
  }
  const caps = await capabilities(actor, organizationId, [
    permissions.create,
    permissions.update,
    permissions.delete,
  ]);
  return {
    ...pageResult(data, total, query),
    capabilities: {
      create: caps[permissions.create],
      update: caps[permissions.update],
      delete: caps[permissions.delete],
    },
  };
}

export async function createResource(
  resource: Exclude<ResourceName, "organizations">,
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  const permissions =
    resource === "memberships"
      ? ({
          view: "organization.view",
          create: "organization.manage_members",
          update: "organization.manage_members",
          delete: "organization.manage_members",
        } as const)
      : resource === "participations"
        ? ({
            view: "competition.view",
            create: "competition.update",
            update: "competition.update",
            delete: "competition.update",
          } as const)
        : resource === "assignments"
          ? ({
              view: "official.view",
              create: "official.update",
              update: "official.update",
              delete: "official.update",
            } as const)
          : permissionMap[resource];
  await authorizeOrganization(actor, organizationId, permissions.create);
  const data = schemas[resource].parse(input) as Record<string, unknown>;
  await assertTenantRelations(resource, organizationId, data);
  return db.$transaction(async (tx) => {
    let created: { id: string };
    if (resource === "memberships") {
      const [user, role] = await Promise.all([
        tx.user.findFirst({
          where: { email: String(data.email), isActive: true, deletedAt: null },
        }),
        tx.role.findFirst({
          where: { organizationId, key: String(data.roleKey) },
        }),
      ]);
      if (!user || !role)
        throw new ApiError(
          400,
          "Pengguna atau role organisasi tidak ditemukan.",
        );
      created = await tx.organizationMember.create({
        data: {
          organizationId,
          userId: user.id,
          roleId: role.id,
          isActive: Boolean(data.isActive),
        },
      });
    } else if (resource === "competitions")
      created = await tx.competition.create({
        data: {
          ...(data as Prisma.CompetitionUncheckedCreateInput),
          organizationId,
        },
      });
    else if (resource === "seasons") {
      if (data.isActive || data.status === "ACTIVE")
        await tx.season.updateMany({
          where: { competitionId: String(data.competitionId), isActive: true },
          data: { isActive: false },
        });
      created = await tx.season.create({
        data: data as Prisma.SeasonUncheckedCreateInput,
      });
    } else if (resource === "clubs")
      created = await tx.club.create({
        data: { ...(data as Prisma.ClubUncheckedCreateInput), organizationId },
      });
    else if (resource === "venues")
      created = await tx.venue.create({
        data: { ...(data as Prisma.VenueUncheckedCreateInput), organizationId },
      });
    else if (resource === "officials")
      created = await tx.official.create({
        data: {
          ...(data as Prisma.OfficialUncheckedCreateInput),
          organizationId,
        },
      });
    else if (resource === "participations")
      created = await tx.competitionClub.create({
        data: {
          ...(data as Prisma.CompetitionClubUncheckedCreateInput),
          organizationId,
        },
      });
    else
      created = await tx.officialAssignment.create({
        data: data as Prisma.OfficialAssignmentUncheckedCreateInput,
      });
    await audit(
      tx,
      actor,
      organizationId,
      "CREATE",
      resource,
      created.id,
      null,
      created,
    );
    return created;
  });
}

async function scopedExisting(
  resource: ResourceName,
  id: string,
  organizationId: string,
) {
  if (resource === "organizations")
    return db.organization.findFirst({ where: { id, deletedAt: null } });
  if (resource === "memberships")
    return db.organizationMember.findFirst({ where: { id, organizationId } });
  if (resource === "competitions")
    return db.competition.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  if (resource === "seasons")
    return db.season.findFirst({
      where: { id, competition: { organizationId, deletedAt: null } },
    });
  if (resource === "clubs")
    return db.club.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  if (resource === "venues")
    return db.venue.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  if (resource === "officials")
    return db.official.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
  if (resource === "participations")
    return db.competitionClub.findFirst({ where: { id, organizationId } });
  return db.officialAssignment.findFirst({
    where: { id, official: { organizationId, deletedAt: null } },
  });
}

export async function updateResource(
  resource: ResourceName,
  id: string,
  actor: Actor,
  organizationId: string,
  input: unknown,
) {
  const permission: PermissionKey =
    resource === "organizations"
      ? "organization.update"
      : resource === "memberships"
        ? "organization.manage_members"
        : resource === "participations"
          ? "competition.update"
          : resource === "assignments"
            ? "official.update"
            : permissionMap[resource].update;
  await authorizeOrganization(actor, organizationId, permission);
  const before = await scopedExisting(resource, id, organizationId);
  if (!before || (resource === "organizations" && before.id !== organizationId))
    throw new ApiError(404, "Data tidak ditemukan.");
  const data = schemas[resource].parse(input) as Record<string, unknown>;
  await assertTenantRelations(resource, organizationId, data);
  if (resource === "organizations" && data.ownerId) {
    const member = await db.organizationMember.findFirst({
      where: { organizationId, userId: String(data.ownerId), isActive: true },
    });
    if (!member)
      throw new ApiError(
        400,
        "Owner baru harus menjadi anggota aktif organisasi.",
      );
  }
  return db.$transaction(async (tx) => {
    let updated: { id: string };
    if (resource === "organizations")
      updated = await tx.organization.update({
        where: { id },
        data: data as Prisma.OrganizationUncheckedUpdateInput,
      });
    else if (resource === "memberships") {
      const [user, role] = await Promise.all([
        tx.user.findFirst({
          where: { email: String(data.email), isActive: true, deletedAt: null },
        }),
        tx.role.findFirst({
          where: { organizationId, key: String(data.roleKey) },
        }),
      ]);
      if (!user || !role)
        throw new ApiError(
          400,
          "Pengguna atau role organisasi tidak ditemukan.",
        );
      updated = await tx.organizationMember.update({
        where: { id },
        data: {
          userId: user.id,
          roleId: role.id,
          isActive: Boolean(data.isActive),
        },
      });
    } else if (resource === "competitions")
      updated = await tx.competition.update({
        where: { id },
        data: data as Prisma.CompetitionUncheckedUpdateInput,
      });
    else if (resource === "seasons") {
      if (data.isActive || data.status === "ACTIVE")
        await tx.season.updateMany({
          where: {
            competitionId: String(data.competitionId),
            isActive: true,
            id: { not: id },
          },
          data: { isActive: false },
        });
      updated = await tx.season.update({
        where: { id },
        data: data as Prisma.SeasonUncheckedUpdateInput,
      });
    } else if (resource === "clubs")
      updated = await tx.club.update({
        where: { id },
        data: data as Prisma.ClubUncheckedUpdateInput,
      });
    else if (resource === "venues")
      updated = await tx.venue.update({
        where: { id },
        data: data as Prisma.VenueUncheckedUpdateInput,
      });
    else if (resource === "officials")
      updated = await tx.official.update({
        where: { id },
        data: data as Prisma.OfficialUncheckedUpdateInput,
      });
    else if (resource === "participations")
      updated = await tx.competitionClub.update({
        where: { id },
        data: data as Prisma.CompetitionClubUncheckedUpdateInput,
      });
    else
      updated = await tx.officialAssignment.update({
        where: { id },
        data: data as Prisma.OfficialAssignmentUncheckedUpdateInput,
      });
    await audit(
      tx,
      actor,
      organizationId,
      "UPDATE",
      resource,
      id,
      before,
      updated,
    );
    return updated;
  });
}

export async function archiveResource(
  resource: ResourceName,
  id: string,
  actor: Actor,
  organizationId: string,
) {
  const permission: PermissionKey =
    resource === "organizations"
      ? "organization.update"
      : resource === "memberships"
        ? "organization.manage_members"
        : resource === "participations"
          ? "competition.update"
          : resource === "assignments"
            ? "official.update"
            : permissionMap[resource].delete;
  await authorizeOrganization(actor, organizationId, permission);
  const before = await scopedExisting(resource, id, organizationId);
  if (!before || (resource === "organizations" && before.id !== organizationId))
    throw new ApiError(404, "Data tidak ditemukan.");
  return db.$transaction(async (tx) => {
    let updated: { id: string };
    if (resource === "organizations")
      updated = await tx.organization.update({
        where: { id },
        data: { status: "ARCHIVED", deletedAt: new Date() },
      });
    else if (resource === "memberships")
      updated = await tx.organizationMember.update({
        where: { id },
        data: { isActive: false },
      });
    else if (resource === "competitions")
      updated = await tx.competition.update({
        where: { id },
        data: { status: "ARCHIVED", deletedAt: new Date() },
      });
    else if (resource === "seasons")
      updated = await tx.season.update({
        where: { id },
        data: { status: "ARCHIVED", isActive: false },
      });
    else if (resource === "clubs")
      updated = await tx.club.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    else if (resource === "venues")
      updated = await tx.venue.update({
        where: { id },
        data: { status: "INACTIVE", deletedAt: new Date() },
      });
    else if (resource === "officials")
      updated = await tx.official.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    else if (resource === "participations")
      updated = await tx.competitionClub.update({
        where: { id },
        data: { status: "WITHDRAWN" },
      });
    else
      updated = await tx.officialAssignment.update({
        where: { id },
        data: { endsAt: new Date() },
      });
    await audit(
      tx,
      actor,
      organizationId,
      "DELETE",
      resource,
      id,
      before,
      updated,
    );
    return updated;
  });
}
