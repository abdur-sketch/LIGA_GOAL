import { Prisma, PublicationStatus, type AuditAction } from "@prisma/client";
import { activeDatabaseTransaction, db, rootDb } from "@/lib/db";
import { ApiError, authorizeOrganization, type ApiActor } from "@/lib/auth/api";
import { withPlatformDatabase, withPublicDatabase, withTenantDatabase } from "@/lib/tenant-db";
import {
  competitionPublicationInputSchema,
  discoveryQuerySchema,
  moderationActionSchema,
  organizerDirectoryQuerySchema,
  organizerProfileInputSchema,
  publicationActionSchema,
} from "./validation";

const publicCompetitionStatuses = ["REGISTRATION", "ONGOING", "COMPLETED", "ARCHIVED"] as const;
const published = PublicationStatus.PUBLISHED;

export function normalizeDiscoverySearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("id-ID").replace(/\s+/g, " ").trim();
}

export const discoveryCompetitionWhere: Prisma.CompetitionWhereInput = {
  deletedAt: null,
  status: { in: [...publicCompetitionStatuses] },
  publication: { is: { status: published } },
  organization: {
    status: "ACTIVE",
    deletedAt: null,
    publicProfile: { is: { status: published } },
  },
};

async function inPublicDatabase<T>(operation: () => Promise<T>) {
  return activeDatabaseTransaction() ? operation() : withPublicDatabase(operation);
}

async function inTenantDatabase<T>(organizationId: string, operation: () => Promise<T>) {
  return activeDatabaseTransaction() ? operation() : withTenantDatabase(rootDb, organizationId, operation);
}

async function inPlatformDatabase<T>(operation: () => Promise<T>) {
  return activeDatabaseTransaction() ? operation() : withPlatformDatabase(rootDb, operation);
}

async function resolveAreaFilter(provinceSlug?: string, citySlug?: string) {
  const province = provinceSlug ? await db.administrativeArea.findFirst({ where: { slug: provinceSlug, type: "PROVINCE", isActive: true } }) : null;
  if (provinceSlug && !province) return { valid: false as const, province: null, city: null };
  const city = citySlug ? await db.administrativeArea.findFirst({ where: { slug: citySlug, type: { in: ["REGENCY", "CITY"] }, isActive: true, ...(province ? { parentId: province.id } : {}) } }) : null;
  if (citySlug && !city) return { valid: false as const, province, city: null };
  return { valid: true as const, province: province ?? (city?.parentId ? await db.administrativeArea.findUnique({ where: { id: city.parentId } }) : null), city };
}

const directoryInclude = Prisma.validator<Prisma.CompetitionInclude>()({
  organization: { select: { name: true, slug: true, publicProfile: { select: { publicSlug: true, displayName: true } } } },
  publication: { include: { province: { select: { name: true, slug: true, code: true } }, city: { select: { name: true, slug: true, code: true } } } },
  seasons: { where: { status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { startsAt: "desc" }, take: 2 },
  _count: { select: { clubEntries: { where: { status: "APPROVED" } }, matches: { where: { publishedAt: { not: null } } } } },
});

async function searchPublicCompetitionsUnsafe(raw: unknown) {
  const input = discoveryQuerySchema.parse(raw);
  const areas = await resolveAreaFilter(input.province, input.city);
  if (!areas.valid) return { items: [], total: 0, page: input.page, pageSize: input.pageSize, pageCount: 0, filters: input };
  const search = input.q ? normalizeDiscoverySearch(input.q) : "";
  const where: Prisma.CompetitionWhereInput = {
    ...discoveryCompetitionWhere,
    ...(input.format ? { format: input.format } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.season ? { seasons: { some: { OR: [{ id: input.season }, { name: { equals: input.season, mode: "insensitive" } }] } } } : {}),
    publication: { is: {
      status: published,
      ...(areas.province ? { provinceId: areas.province.id } : {}),
      ...(areas.city ? { cityId: areas.city.id } : {}),
      ...(input.ageCategory ? { ageCategory: { equals: input.ageCategory, mode: "insensitive" } } : {}),
      ...(search ? { searchText: { contains: search } } : {}),
    } },
  };
  const orderBy: Prisma.CompetitionOrderByWithRelationInput[] = input.sort === "upcoming"
    ? [{ startsAt: "asc" }, { id: "asc" }]
    : input.sort === "popular"
      ? [{ publication: { popularityScore: "desc" } }, { publication: { publishedAt: "desc" } }, { id: "asc" }]
      : [{ publication: { publishedAt: "desc" } }, { id: "asc" }];
  const [total, items] = await Promise.all([
    db.competition.count({ where }),
    db.competition.findMany({ where, include: directoryInclude, orderBy, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize, pageCount: Math.ceil(total / input.pageSize), filters: input };
}

export const searchPublicCompetitions = (raw: unknown) => inPublicDatabase(() => searchPublicCompetitionsUnsafe(raw));

export const listActiveRegions = () => inPublicDatabase(async () => {
  const provinces = await db.administrativeArea.findMany({ where: { type: "PROVINCE", isActive: true }, select: { id: true, code: true, name: true, slug: true, children: { where: { isActive: true }, select: { id: true, code: true, name: true, slug: true, type: true }, orderBy: [{ type: "asc" }, { name: "asc" }] } }, orderBy: { name: "asc" } });
  const dataset = await db.regionDataset.findFirst({ where: { isActive: true }, select: { sourceName: true, sourceVersion: true, sourceUrl: true, sourceChecksum: true, effectiveAt: true } });
  return { provinces, dataset };
});

async function listPublicOrganizersUnsafe(raw: unknown) {
  const input = organizerDirectoryQuerySchema.parse(raw);
  const areas = await resolveAreaFilter(input.province, input.city);
  if (!areas.valid) return { items: [], total: 0, page: input.page, pageSize: input.pageSize, pageCount: 0 };
  const where: Prisma.PublicOrganizerProfileWhereInput = {
    status: published,
    organization: { status: "ACTIVE", deletedAt: null },
    ...(areas.province ? { provinceId: areas.province.id } : {}),
    ...(areas.city ? { cityId: areas.city.id } : {}),
    ...(input.q ? { OR: [{ displayName: { contains: input.q, mode: "insensitive" } }, { description: { contains: input.q, mode: "insensitive" } }] } : {}),
  };
  const [total, items] = await Promise.all([
    db.publicOrganizerProfile.count({ where }),
    db.publicOrganizerProfile.findMany({
      where,
      select: {
        id: true, publicSlug: true, displayName: true, description: true, logoUrl: true, websiteUrl: true, publishedAt: true,
        province: { select: { name: true, slug: true } }, city: { select: { name: true, slug: true } },
        organization: { select: { _count: { select: { competitionPublications: { where: { status: published } } } } } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize,
    }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize, pageCount: Math.ceil(total / input.pageSize) };
}

export const listPublicOrganizers = (raw: unknown) => inPublicDatabase(() => listPublicOrganizersUnsafe(raw));

export const getPublicOrganizer = (slug: string) => inPublicDatabase(async () => {
  const profile = await db.publicOrganizerProfile.findFirst({
    where: { publicSlug: slug, status: published, organization: { status: "ACTIVE", deletedAt: null } },
    select: {
      id: true, organizationId: true, publicSlug: true, displayName: true, description: true, logoUrl: true, websiteUrl: true,
      publicContactEmail: true, publicContactPhone: true, publishedAt: true, updatedAt: true,
      province: { select: { name: true, slug: true, code: true } }, city: { select: { name: true, slug: true, code: true } },
      organization: { select: { competitions: {
        where: discoveryCompetitionWhere,
        select: { id: true, name: true, description: true, logoUrl: true, status: true, startsAt: true, endsAt: true, publication: { select: { publicSlug: true, ageCategory: true, publishedAt: true } } },
        orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      } } },
    },
  });
  if (!profile) throw new ApiError(404, "Penyelenggara tidak ditemukan.");
  return profile;
});

export const getRegionDiscovery = (provinceSlug: string, citySlug?: string, query: Record<string, unknown> = {}) => inPublicDatabase(async () => {
  const areas = await resolveAreaFilter(provinceSlug, citySlug);
  if (!areas.valid || !areas.province) throw new ApiError(404, "Wilayah tidak ditemukan.");
  const results = await searchPublicCompetitionsUnsafe({ ...query, province: areas.province.slug, city: areas.city?.slug });
  return { province: areas.province, city: areas.city, results };
});

export const getNationalDiscoveryHome = () => inPublicDatabase(async () => {
  const [popular, organizers, provinces] = await Promise.all([
    searchPublicCompetitionsUnsafe({ sort: "popular", page: 1, pageSize: 6 }),
    listPublicOrganizersUnsafe({ page: 1, pageSize: 6 }),
    db.administrativeArea.findMany({
      where: { type: "PROVINCE", isActive: true, competitionProvinces: { some: { status: published, competition: discoveryCompetitionWhere } } },
      select: { id: true, name: true, slug: true, _count: { select: { competitionProvinces: { where: { status: published, competition: discoveryCompetitionWhere } } } } },
      orderBy: { name: "asc" }, take: 12,
    }),
  ]);
  return { popular: popular.items, organizers: organizers.items, provinces };
});

export const resolvePublicRedirect = (oldPath: string) => inPublicDatabase(async () => {
  if (!oldPath.startsWith("/") || oldPath.startsWith("//")) return null;
  const target = await db.publicSlugRedirect.findUnique({ where: { oldPath }, select: { newPath: true } });
  return target?.newPath.startsWith("/") && !target.newPath.startsWith("//") ? target.newPath : null;
});

async function validateAreas(provinceId?: string | null, cityId?: string | null) {
  const province = provinceId ? await db.administrativeArea.findFirst({ where: { id: provinceId, type: "PROVINCE", isActive: true } }) : null;
  if (provinceId && !province) throw new ApiError(422, "Provinsi tidak valid atau tidak aktif.");
  const city = cityId ? await db.administrativeArea.findFirst({ where: { id: cityId, type: { in: ["REGENCY", "CITY"] }, isActive: true } }) : null;
  if (cityId && !city) throw new ApiError(422, "Kabupaten/kota tidak valid atau tidak aktif.");
  if (city && province && city.parentId !== province.id) throw new ApiError(422, "Kabupaten/kota tidak berada dalam provinsi yang dipilih.");
  return { provinceId: province?.id ?? city?.parentId ?? null, cityId: city?.id ?? null };
}

function auditJson(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

export async function saveOrganizerPublicProfile(actor: ApiActor, raw: unknown) {
  const input = organizerProfileInputSchema.parse(raw);
  return inTenantDatabase(input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "organization.public_profile.manage");
    const organization = await db.organization.findFirst({ where: { id: input.organizationId, status: "ACTIVE", deletedAt: null } });
    if (!organization) throw new ApiError(404, "Organisasi aktif tidak ditemukan.");
    const areas = await validateAreas(input.provinceId, input.cityId);
    const before = await db.publicOrganizerProfile.findUnique({ where: { organizationId: input.organizationId } });
    const nextStatus = before?.status === "SUSPENDED" ? "SUSPENDED" : before?.status === "PUBLISHED" ? "PENDING_REVIEW" : "DRAFT";
    const profile = await db.publicOrganizerProfile.upsert({
      where: { organizationId: input.organizationId },
      update: { displayName: input.displayName, description: input.description, logoUrl: input.logoUrl, websiteUrl: input.websiteUrl, publicContactEmail: input.publicContactEmail, publicContactPhone: input.publicContactPhone, ...areas, status: nextStatus },
      create: { organizationId: input.organizationId, publicSlug: organization.slug, displayName: input.displayName, description: input.description, logoUrl: input.logoUrl, websiteUrl: input.websiteUrl, publicContactEmail: input.publicContactEmail, publicContactPhone: input.publicContactPhone, ...areas },
    });
    await db.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: before ? "UPDATE" : "CREATE", resourceType: "PublicOrganizerProfile", resourceId: profile.id, before: before ? auditJson(before) : undefined, after: auditJson(profile) } });
    return profile;
  });
}

async function publicCompetitionSlug(organizationId: string, competitionId: string, base: string) {
  const existing = await db.competitionPublication.findUnique({ where: { competitionId }, select: { publicSlug: true } });
  if (existing) return existing.publicSlug;
  const conflict = await db.competitionPublication.findUnique({ where: { publicSlug: base }, select: { organizationId: true } });
  if (!conflict) return base;
  const organization = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { slug: true } });
  return `${base}--${organization.slug}`;
}

export async function saveCompetitionPublication(actor: ApiActor, raw: unknown) {
  const input = competitionPublicationInputSchema.parse(raw);
  return inTenantDatabase(input.organizationId, async () => {
    await authorizeOrganization(actor, input.organizationId, "competition.publication.manage");
    const competition = await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId, deletedAt: null }, include: { organization: { select: { name: true } } } });
    if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan dalam organisasi ini.");
    const areas = await validateAreas(input.provinceId, input.cityId);
    const before = await db.competitionPublication.findUnique({ where: { competitionId: input.competitionId } });
    const nextStatus = before?.status === "SUSPENDED" ? "SUSPENDED" : before?.status === "PUBLISHED" ? "PENDING_REVIEW" : "DRAFT";
    const publicSlug = await publicCompetitionSlug(input.organizationId, competition.id, competition.slug);
    const searchText = normalizeDiscoverySearch([competition.name, competition.description, competition.category, competition.location, competition.organization.name, input.ageCategory].filter(Boolean).join(" "));
    const publication = await db.competitionPublication.upsert({
      where: { competitionId: input.competitionId },
      update: { ...areas, ageCategory: input.ageCategory, searchText, status: nextStatus },
      create: { organizationId: input.organizationId, competitionId: input.competitionId, publicSlug, ...areas, ageCategory: input.ageCategory, searchText },
    });
    await db.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: before ? "UPDATE" : "CREATE", resourceType: "CompetitionPublication", resourceId: publication.id, before: before ? auditJson(before) : undefined, after: auditJson(publication) } });
    return publication;
  });
}

export async function organizerPublicationAction(actor: ApiActor, raw: unknown) {
  const input = publicationActionSchema.parse(raw);
  return inTenantDatabase(input.organizationId, async () => {
    const permission = input.entity === "organizer" ? "organization.public_profile.manage" : "competition.publication.manage";
    await authorizeOrganization(actor, input.organizationId, permission);
    const before = await (input.entity === "organizer"
      ? db.publicOrganizerProfile.findFirst({ where: { id: input.id, organizationId: input.organizationId } })
      : db.competitionPublication.findFirst({ where: { id: input.id, organizationId: input.organizationId } }));
    if (!before) throw new ApiError(404, "Konten publik tidak ditemukan.");
    if (before.status === "SUSPENDED") throw new ApiError(409, "Konten yang disuspensi hanya dapat dipulihkan moderator platform.");
    const status: PublicationStatus = input.action === "submit" ? "PENDING_REVIEW" : "UNPUBLISHED";
    if (input.action === "submit" && !["DRAFT", "UNPUBLISHED", "PENDING_REVIEW"].includes(before.status)) throw new ApiError(409, "Status konten tidak dapat diajukan.");
    const data = { status, submittedAt: input.action === "submit" ? new Date() : before.submittedAt, unpublishedAt: input.action === "unpublish" ? new Date() : null };
    const after = input.entity === "organizer"
      ? await db.publicOrganizerProfile.update({ where: { id: input.id }, data })
      : await db.competitionPublication.update({ where: { id: input.id }, data });
    await db.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "UPDATE", resourceType: input.entity === "organizer" ? "PublicOrganizerProfile" : "CompetitionPublication", resourceId: input.id, before: auditJson(before), after: auditJson(after) } });
    return after;
  });
}

async function requireDiscoveryPermission(actor: ApiActor, permission: "discovery.moderate.view" | "discovery.moderate.manage") {
  if (!actor.isPlatformAdmin) throw new ApiError(403, "Akses moderator platform diperlukan.");
  const grant = await db.platformPermissionGrant.findUnique({ where: { userId_permission: { userId: actor.id, permission } } });
  if (!grant) throw new ApiError(403, "Permission discovery platform tidak tersedia.");
}

export const discoveryModerationQueue = (actor: ApiActor) => inPlatformDatabase(async () => {
  await requireDiscoveryPermission(actor, "discovery.moderate.view");
  const [organizers, competitions] = await Promise.all([
    db.publicOrganizerProfile.findMany({ where: { status: { in: ["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"] } }, include: { organization: { select: { name: true, slug: true } }, province: true, city: true }, orderBy: [{ submittedAt: "asc" }, { id: "asc" }], take: 100 }),
    db.competitionPublication.findMany({ where: { status: { in: ["PENDING_REVIEW", "SUSPENDED", "UNPUBLISHED"] } }, include: { competition: { select: { name: true, slug: true, status: true } }, organization: { select: { name: true, slug: true } }, province: true, city: true }, orderBy: [{ submittedAt: "asc" }, { id: "asc" }], take: 100 }),
  ]);
  return { organizers, competitions };
});

export async function moderateDiscoveryPublication(actor: ApiActor, raw: unknown) {
  const input = moderationActionSchema.parse(raw);
  return inPlatformDatabase(async () => {
    await requireDiscoveryPermission(actor, "discovery.moderate.manage");
    const before = input.entity === "organizer" ? await db.publicOrganizerProfile.findUnique({ where: { id: input.id } }) : await db.competitionPublication.findUnique({ where: { id: input.id } });
    if (!before) throw new ApiError(404, "Konten moderasi tidak ditemukan.");
    const status: PublicationStatus = input.action === "publish" ? "PUBLISHED" : input.action === "suspend" ? "SUSPENDED" : "UNPUBLISHED";
    if (input.action === "publish" && !["PENDING_REVIEW", "UNPUBLISHED", "SUSPENDED"].includes(before.status)) throw new ApiError(409, "Konten harus diajukan sebelum diterbitkan.");
    const data = { status, reviewedById: actor.id, reviewReason: input.reason, publishedAt: input.action === "publish" ? new Date() : before.publishedAt, suspendedAt: input.action === "suspend" ? new Date() : null, unpublishedAt: input.action === "unpublish" ? new Date() : null };
    const after = input.entity === "organizer" ? await db.publicOrganizerProfile.update({ where: { id: input.id }, data }) : await db.competitionPublication.update({ where: { id: input.id }, data });
    const action: AuditAction = input.action === "publish" ? "APPROVE" : input.action === "suspend" ? "REJECT" : "UPDATE";
    await db.auditLog.create({ data: { organizationId: before.organizationId, actorId: actor.id, action, resourceType: input.entity === "organizer" ? "PublicOrganizerProfile" : "CompetitionPublication", resourceId: input.id, before: auditJson(before), after: auditJson({ ...after, moderationReason: input.reason }) } });
    return after;
  });
}

export const discoveryWorkspace = (actor: ApiActor, organizationId: string) => inTenantDatabase(organizationId, async () => {
  await authorizeOrganization(actor, organizationId, "organization.public_profile.manage");
  const [profile, competitions, regions] = await Promise.all([
    db.publicOrganizerProfile.findUnique({ where: { organizationId } }),
    db.competition.findMany({ where: { organizationId, deletedAt: null }, include: { publication: true }, orderBy: { createdAt: "desc" } }),
    db.administrativeArea.findMany({ where: { type: "PROVINCE", isActive: true }, select: { id: true, name: true, children: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }),
  ]);
  return { profile, competitions, regions };
});

export const publicSitemapDiscovery = () => inPublicDatabase(async () => {
  const [organizers, competitions, provinces, cities] = await Promise.all([
    db.publicOrganizerProfile.findMany({ where: { status: published, organization: { status: "ACTIVE", deletedAt: null } }, select: { publicSlug: true, updatedAt: true } }),
    db.competitionPublication.findMany({ where: { status: published, competition: discoveryCompetitionWhere }, select: { publicSlug: true, updatedAt: true } }),
    db.administrativeArea.findMany({ where: { type: "PROVINCE", isActive: true, competitionProvinces: { some: { status: published, competition: discoveryCompetitionWhere } } }, select: { slug: true, updatedAt: true } }),
    db.administrativeArea.findMany({ where: { type: { in: ["REGENCY", "CITY"] }, isActive: true, competitionCities: { some: { status: published, competition: discoveryCompetitionWhere } } }, select: { slug: true, updatedAt: true, parent: { select: { slug: true } } } }),
  ]);
  return { organizers, competitions, provinces, cities };
});
