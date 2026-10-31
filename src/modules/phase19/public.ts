import { activeDatabaseTransaction, db } from "@/lib/db";
import { withPublicDatabase } from "@/lib/tenant-db";
import { discoveryCompetitionWhere } from "@/modules/phase16/service";

async function inPublic<T>(operation: () => Promise<T>) {
  return activeDatabaseTransaction() ? operation() : withPublicDatabase(operation);
}

const sessionInclude = {
  competition: { select: { id: true, name: true, publication: { select: { publicSlug: true } }, genericProfile: { select: { kind: true } } } },
  entries: { include: { entry: { include: { participant: { select: { id: true, name: true, slug: true, type: true, logoUrl: true, institution: true } } } } }, orderBy: { order: "asc" as const } },
  venue: { select: { name: true, city: true } },
} as const;

export const getGenericPublicHome = () => inPublic(async () => {
  const now = new Date();
  const [sessions, results] = await Promise.all([
    db.competitionSession.findMany({ where: { publishedAt: { not: null }, status: { in: ["SCHEDULED", "LIVE"] }, competition: discoveryCompetitionWhere, OR: [{ startsAt: { gte: now } }, { status: "LIVE" }] }, include: sessionInclude, orderBy: [{ status: "desc" }, { startsAt: "asc" }], take: 6 }),
    db.genericResult.findMany({ where: { status: "PUBLISHED", publishedAt: { not: null }, competition: discoveryCompetitionWhere }, include: { competition: { select: { name: true, publication: { select: { publicSlug: true } }, genericProfile: { select: { kind: true } } } }, entry: { include: { participant: { select: { name: true, type: true, institution: true } } } }, session: { select: { name: true } } }, orderBy: [{ publishedAt: "desc" }, { rank: "asc" }], take: 8 }),
  ]);
  return { sessions, results };
});

export const listPublicAgenda = () => inPublic(() => db.competitionSession.findMany({ where: { publishedAt: { not: null }, competition: discoveryCompetitionWhere }, include: sessionInclude, orderBy: [{ startsAt: "desc" }, { sequence: "asc" }], take: 100 }));

export const listPublicGenericResults = () => inPublic(() => db.genericResult.findMany({ where: { status: "PUBLISHED", publishedAt: { not: null }, competition: discoveryCompetitionWhere }, include: { competition: { select: { name: true, publication: { select: { publicSlug: true } }, genericProfile: { select: { kind: true } } } }, entry: { include: { participant: { select: { name: true, type: true, institution: true, logoUrl: true } } } }, session: { select: { name: true } } }, orderBy: [{ publishedAt: "desc" }, { competitionId: "asc" }, { rank: "asc" }], take: 200 }));

export const listPublicGenericParticipants = (search = "") => inPublic(() => db.competitionParticipant.findMany({ where: { isActive: true, deletedAt: null, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { institution: { contains: search, mode: "insensitive" } }] } : {}), entries: { some: { status: "APPROVED", competition: discoveryCompetitionWhere } } }, select: { id: true, name: true, slug: true, type: true, displayName: true, logoUrl: true, institution: true, entries: { where: { status: "APPROVED", competition: discoveryCompetitionWhere }, select: { competition: { select: { name: true, publication: { select: { publicSlug: true } }, genericProfile: { select: { kind: true } } } } } } }, orderBy: { name: "asc" }, take: 100 }));
