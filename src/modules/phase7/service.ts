import { ArticleStatus, MatchStatus, Prisma, PublicFollowType } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, authorizeOrganization, type getApiActor } from "@/lib/auth/api";
import { articleActionInput, articleInput, followInput, notificationInput, preferenceInput, sanitizePlainText } from "./validation";

type Actor = Awaited<ReturnType<typeof getApiActor>>;
const publicCompetitionStatuses = ["REGISTRATION", "ONGOING", "COMPLETED", "ARCHIVED"] as const;
const publicMatchStatuses: MatchStatus[] = ["SCHEDULED", "LINEUP_CONFIRMED", "LIVE_FIRST_HALF", "HALF_TIME", "LIVE_SECOND_HALF", "EXTRA_TIME", "PENALTY_SHOOTOUT", "FINISHED_PENDING_APPROVAL", "OFFICIAL", "POSTPONED", "CANCELLED", "ABANDONED"];
const liveStatuses: MatchStatus[] = ["LIVE_FIRST_HALF", "HALF_TIME", "LIVE_SECOND_HALF", "EXTRA_TIME", "PENALTY_SHOOTOUT"];

export const publicCompetitionWhere = {
  deletedAt: null,
  status: { in: [...publicCompetitionStatuses] },
  organization: { status: "ACTIVE" as const, deletedAt: null },
};

const matchInclude = Prisma.validator<Prisma.MatchInclude>()({
  competition: { select: { name: true, slug: true, logoUrl: true } },
  season: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true } },
  venue: { select: { name: true, city: true } },
  homeTeam: { select: { id: true, club: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true } } } },
  awayTeam: { select: { id: true, club: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true } } } },
});

export async function getPublicHome() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [live, today, upcoming, results, competitions, articles, snapshot] = await Promise.all([
    db.match.findMany({ where: { status: { in: liveStatuses }, publishedAt: { not: null }, competition: publicCompetitionWhere }, include: matchInclude, orderBy: { kickoffAt: "asc" }, take: 6 }),
    db.match.findMany({ where: { kickoffAt: { gte: start, lt: end }, status: { in: publicMatchStatuses }, publishedAt: { not: null }, competition: publicCompetitionWhere }, include: matchInclude, orderBy: { kickoffAt: "asc" }, take: 8 }),
    db.match.findMany({ where: { kickoffAt: { gte: end }, status: { in: publicMatchStatuses }, publishedAt: { not: null }, competition: publicCompetitionWhere }, include: matchInclude, orderBy: { kickoffAt: "asc" }, take: 6 }),
    db.match.findMany({ where: { status: "OFFICIAL", publishedAt: { not: null }, competition: publicCompetitionWhere }, include: matchInclude, orderBy: { kickoffAt: "desc" }, take: 6 }),
    db.competition.findMany({ where: publicCompetitionWhere, include: { organization: { select: { name: true } }, seasons: { where: { status: { in: ["ACTIVE", "COMPLETED"] } }, orderBy: { startsAt: "desc" }, take: 1 }, _count: { select: { clubEntries: { where: { status: "APPROVED" } } } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
    db.article.findMany({ where: publishedArticleWhere(), include: { competition: { select: { name: true, slug: true } } }, orderBy: { publishedAt: "desc" }, take: 4 }),
    db.statisticsSnapshot.findFirst({ where: { status: "PUBLISHED", publishedAt: { not: null }, competition: publicCompetitionWhere }, orderBy: { publishedAt: "desc" }, include: { standings: { orderBy: { position: "asc" }, take: 5, include: { club: { select: { name: true, slug: true, logoUrl: true } } } }, playerStatistics: { orderBy: [{ goals: "desc" }, { assists: "desc" }], take: 5, include: { player: { select: { id: true, fullName: true, displayName: true, photoUrl: true } }, club: { select: { name: true, slug: true } } } }, competition: { select: { name: true, slug: true } }, season: { select: { name: true } } } }),
  ]);
  return { live, today, upcoming, results, competitions, articles, snapshot, generatedAt: now };
}

export async function listPublicMatches(input: { date?: string; competitionId?: string; seasonId?: string; status?: string; search?: string; page?: number }) {
  const page = Math.max(1, input.page || 1); const take = 24;
  const where: Prisma.MatchWhereInput = { publishedAt: { not: null }, status: { in: publicMatchStatuses }, competition: publicCompetitionWhere };
  if (input.competitionId) where.competitionId = input.competitionId;
  if (input.seasonId) where.seasonId = input.seasonId;
  if (input.status && publicMatchStatuses.includes(input.status as MatchStatus)) where.status = input.status as MatchStatus;
  if (input.date) { const from = new Date(`${input.date}T00:00:00+07:00`); if (!Number.isNaN(from.valueOf())) { const to = new Date(from); to.setDate(to.getDate() + 1); where.kickoffAt = { gte: from, lt: to }; } }
  if (input.search) where.OR = [{ homeTeam: { club: { name: { contains: input.search, mode: "insensitive" } } } }, { awayTeam: { club: { name: { contains: input.search, mode: "insensitive" } } } }, { competition: { name: { contains: input.search, mode: "insensitive" } } }];
  const [data, total] = await db.$transaction([db.match.findMany({ where, include: matchInclude, orderBy: [{ kickoffAt: "desc" }, { matchNumber: "asc" }], skip: (page - 1) * take, take }), db.match.count({ where })]);
  return { data, meta: { page, pageSize: take, total, pages: Math.ceil(total / take) }, updatedAt: new Date() };
}

export async function getPublicMatch(id: string) {
  const match = await db.match.findFirst({ where: { id, publishedAt: { not: null }, status: { in: publicMatchStatuses }, competition: publicCompetitionWhere }, include: { ...matchInclude, events: { where: { isValid: true }, orderBy: [{ minute: "asc" }, { addedTime: "asc" }], select: { id: true, eventType: true, period: true, minute: true, addedTime: true, teamId: true, player: { select: { id: true, fullName: true, displayName: true } }, relatedPlayer: { select: { id: true, fullName: true, displayName: true } } } }, lineups: { where: { status: "CONFIRMED" }, include: { team: { include: { club: { select: { name: true } } } }, players: { include: { player: { select: { id: true, fullName: true, displayName: true, photoUrl: true } } }, orderBy: [{ role: "asc" }, { shirtNumber: "asc" }] } } }, clockState: true, officialAssignments: { where: { role: "REFEREE" }, select: { role: true, official: { select: { fullName: true } } } }, results: { where: { isCurrent: true }, select: { homeScore: true, awayScore: true, shootoutHome: true, shootoutAway: true, createdAt: true } }, bracketLeg: { include: { tie: { select: { id: true, label: true, round: true, aggregateHome: true, aggregateAway: true, penaltyHome: true, penaltyAway: true } } } } } });
  if (!match) throw new ApiError(404, "Pertandingan tidak ditemukan.");
  return { ...match, isLive: liveStatuses.includes(match.status), stale: liveStatuses.includes(match.status) && Date.now() - match.updatedAt.valueOf() > 120_000, updatedAt: match.updatedAt };
}

export async function listPublicCompetitions() {
  return db.competition.findMany({
    where: publicCompetitionWhere,
    include: {
      organization: { select: { name: true, slug: true } },
      seasons: { orderBy: { startsAt: "desc" }, take: 2 },
      _count: { select: { clubEntries: { where: { status: "APPROVED" } }, matches: { where: { publishedAt: { not: null } } } } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function getPublicCompetition(slug: string) {
  const competition = await db.competition.findFirst({ where: { slug, ...publicCompetitionWhere }, include: { organization: { select: { name: true, slug: true } }, seasons: { orderBy: { startsAt: "desc" } }, clubEntries: { where: { status: "APPROVED" }, distinct: ["clubId"], include: { club: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true, city: true } } } }, matches: { where: { publishedAt: { not: null }, status: { in: publicMatchStatuses } }, include: matchInclude, orderBy: { kickoffAt: "desc" }, take: 30 }, bracketTies: { include: { slots: { include: { club: { select: { name: true, slug: true, logoUrl: true } } } }, winnerTeam: { include: { club: { select: { name: true, slug: true } } } } }, orderBy: [{ round: "asc" }, { position: "asc" }] }, articles: { where: publishedArticleWhere(), orderBy: { publishedAt: "desc" }, take: 6 } } });
  if (!competition) throw new ApiError(404, "Kompetisi tidak ditemukan.");
  const snapshot = await db.statisticsSnapshot.findFirst({ where: { competitionId: competition.id, status: "PUBLISHED", publishedAt: { not: null } }, orderBy: { publishedAt: "desc" }, include: { standings: { orderBy: { position: "asc" }, include: { club: { select: { name: true, slug: true, logoUrl: true } } } }, playerStatistics: { orderBy: [{ goals: "desc" }, { assists: "desc" }], take: 10, include: { player: { select: { id: true, displayName: true, fullName: true, photoUrl: true } }, club: { select: { name: true, slug: true } } } } } });
  return { competition, snapshot };
}

export async function getLatestStandings(competitionId?: string) {
  return db.statisticsSnapshot.findFirst({ where: { ...(competitionId ? { competitionId } : {}), status: "PUBLISHED", publishedAt: { not: null }, competition: publicCompetitionWhere }, orderBy: { publishedAt: "desc" }, include: { competition: { select: { id: true, name: true, slug: true } }, season: { select: { id: true, name: true, tieBreakers: true } }, stage: { select: { id: true, name: true } }, group: { select: { id: true, name: true } }, standings: { orderBy: { position: "asc" }, include: { club: { select: { name: true, shortName: true, slug: true, logoUrl: true } } } } } });
}

function adultOrConsentedPlayerWhere(): Prisma.PlayerWhereInput {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
  return { OR: [{ dateOfBirth: null }, { dateOfBirth: { lte: cutoff } }, { documents: { some: { type: "PARENTAL_CONSENT", isCurrent: true, verificationStatus: "APPROVED" } } }] };
}

export async function listPublicPlayers(search = "") {
  const privacy = adultOrConsentedPlayerWhere();
  return db.player.findMany({ where: { deletedAt: null, status: "ACTIVE", organization: { status: "ACTIVE", deletedAt: null }, AND: [privacy, ...(search ? [{ OR: [{ displayName: { contains: search, mode: "insensitive" as const } }, { fullName: { contains: search, mode: "insensitive" as const } }] }] : [])] }, select: { id: true, displayName: true, fullName: true, photoUrl: true, primaryPosition: true, activeClub: { select: { name: true, slug: true, logoUrl: true } }, registrations: { where: { status: "APPROVED", competition: publicCompetitionWhere }, orderBy: { registrationDate: "desc" }, take: 1, select: { jerseyNumber: true, competition: { select: { name: true, slug: true } } } }, statisticsRows: { where: { snapshot: { status: "PUBLISHED" } }, orderBy: { snapshot: { publishedAt: "desc" } }, take: 1, select: { appearances: true, goals: true, assists: true, yellowCards: true, redCards: true } } }, orderBy: { displayName: "asc" }, take: 60 });
}

export async function getPublicPlayer(id: string) {
  const player = await db.player.findFirst({ where: { id, deletedAt: null, status: "ACTIVE", organization: { status: "ACTIVE", deletedAt: null }, ...adultOrConsentedPlayerWhere() }, select: { id: true, displayName: true, fullName: true, photoUrl: true, primaryPosition: true, activeClub: { select: { name: true, slug: true, logoUrl: true, city: true } }, registrations: { where: { status: "APPROVED", competition: publicCompetitionWhere }, orderBy: { registrationDate: "desc" }, select: { jerseyNumber: true, competition: { select: { name: true, slug: true } }, season: { select: { name: true } }, club: { select: { name: true, slug: true } } } }, statisticsRows: { where: { snapshot: { status: "PUBLISHED" } }, orderBy: { snapshot: { publishedAt: "desc" } }, select: { appearances: true, starts: true, goals: true, assists: true, yellowCards: true, redCards: true, cleanSheets: true, snapshot: { select: { publishedAt: true, competition: { select: { name: true, slug: true } }, season: { select: { name: true } } } } } } } });
  if (!player) throw new ApiError(404, "Pemain tidak ditemukan atau profilnya tidak tersedia untuk publik.");
  return player;
}

export async function listPublicClubs() {
  return db.club.findMany({ where: { deletedAt: null, isActive: true, organization: { status: "ACTIVE", deletedAt: null }, competitionEntries: { some: { status: "APPROVED", competition: publicCompetitionWhere } } }, select: { id: true, organizationId: true, name: true, shortName: true, slug: true, logoUrl: true, city: true, description: true, competitionEntries: { where: { status: "APPROVED", competition: publicCompetitionWhere }, distinct: ["competitionId"], select: { competition: { select: { name: true, slug: true } } } } }, orderBy: { name: "asc" } });
}

export async function getPublicClub(slug: string) {
  const club = await db.club.findFirst({
    where: { slug, deletedAt: null, isActive: true, organization: { status: "ACTIVE", deletedAt: null }, competitionEntries: { some: { status: "APPROVED", competition: publicCompetitionWhere } } },
    select: {
      id: true, organizationId: true, name: true, shortName: true, slug: true, logoUrl: true, city: true, description: true, foundedYear: true,
      homeVenue: { select: { name: true, city: true } },
      competitionEntries: { where: { status: "APPROVED", competition: publicCompetitionWhere }, distinct: ["competitionId"], select: { competition: { select: { name: true, slug: true } }, season: { select: { name: true } } } },
      playerStatisticsRows: { where: { snapshot: { status: "PUBLISHED" } }, orderBy: [{ goals: "desc" }, { assists: "desc" }], take: 8, select: { appearances: true, goals: true, assists: true, player: { select: { id: true, displayName: true, fullName: true, photoUrl: true, dateOfBirth: true, documents: { where: { type: "PARENTAL_CONSENT", isCurrent: true, verificationStatus: "APPROVED" }, select: { id: true }, take: 1 } } } } },
    },
  });
  if (!club) throw new ApiError(404, "Klub tidak ditemukan.");
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
  return { ...club, playerStatisticsRows: club.playerStatisticsRows.filter((row) => !row.player.dateOfBirth || row.player.dateOfBirth <= cutoff || row.player.documents.length > 0).map(({ player, ...row }) => ({ ...row, player: { id: player.id, displayName: player.displayName, fullName: player.fullName, photoUrl: player.photoUrl } })) };
}

export async function getPublicStatistics(competitionId?: string) {
  return db.statisticsSnapshot.findFirst({ where: { ...(competitionId ? { competitionId } : {}), status: "PUBLISHED", publishedAt: { not: null }, competition: publicCompetitionWhere }, orderBy: { publishedAt: "desc" }, include: { competition: { select: { id: true, name: true, slug: true } }, season: { select: { id: true, name: true } }, playerStatistics: { orderBy: [{ goals: "desc" }, { assists: "desc" }, { appearances: "desc" }], take: 50, include: { player: { select: { id: true, displayName: true, fullName: true, photoUrl: true, dateOfBirth: true, documents: { where: { type: "PARENTAL_CONSENT", isCurrent: true, verificationStatus: "APPROVED" }, select: { id: true }, take: 1 } } }, club: { select: { name: true, slug: true, logoUrl: true } } } }, teamStatistics: { orderBy: { goalsFor: "desc" }, include: { club: { select: { name: true, slug: true, logoUrl: true } } } } } });
}

function publishedArticleWhere(): Prisma.ArticleWhereInput { const now = new Date(); return { organizationId: { not: null }, organization: { status: "ACTIVE", deletedAt: null }, AND: [{ OR: [{ status: "PUBLISHED", publishedAt: { lte: now } }, { status: "SCHEDULED", scheduledAt: { lte: now } }] }, { OR: [{ competitionId: null }, { competition: publicCompetitionWhere }] }] }; }
export async function listPublicArticles() { return db.article.findMany({ where: publishedArticleWhere(), include: { organization: { select: { name: true, slug: true } }, competition: { select: { name: true, slug: true } } }, orderBy: { publishedAt: "desc" }, take: 30 }); }
export async function getPublicArticle(slug: string) { const article = await db.article.findFirst({ where: { slug, ...publishedArticleWhere() }, include: { organization: { select: { name: true } }, competition: { select: { name: true, slug: true } } } }); if (!article) throw new ApiError(404, "Berita tidak ditemukan."); return article; }

export async function listAdminArticles(actor: Actor, organizationId: string) { await authorizeOrganization(actor, organizationId, "article.view"); return db.article.findMany({ where: { organizationId }, include: { competition: { select: { name: true } }, createdBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }); }
export async function createArticle(actor: Actor, raw: unknown) { const input = articleInput.parse(raw); await authorizeOrganization(actor, input.organizationId, "article.create"); if (input.competitionId && !await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId } })) throw new ApiError(422, "Kompetisi tidak berada dalam organisasi aktif."); const data = { ...input, excerpt: input.excerpt ? sanitizePlainText(input.excerpt) : null, body: sanitizePlainText(input.body), createdById: actor.id, updatedById: actor.id }; return db.$transaction(async (tx) => { const article = await tx.article.create({ data }); await tx.articleRevision.create({ data: { organizationId: input.organizationId, articleId: article.id, actorId: actor.id, version: 1, snapshot: JSON.parse(JSON.stringify(article)) } }); await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "CREATE", resourceType: "Article", resourceId: article.id, after: JSON.parse(JSON.stringify(article)) } }); return article; }); }
export async function updateArticle(actor: Actor, id: string, raw: unknown) { const input = articleInput.parse(raw); await authorizeOrganization(actor, input.organizationId, "article.update"); if (input.competitionId && !await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId } })) throw new ApiError(422, "Kompetisi tidak berada dalam organisasi aktif."); return db.$transaction(async (tx) => { const before = await tx.article.findFirst({ where: { id, organizationId: input.organizationId } }); if (!before) throw new ApiError(404, "Berita tidak ditemukan."); const article = await tx.article.update({ where: { id }, data: { ...input, excerpt: input.excerpt ? sanitizePlainText(input.excerpt) : null, body: sanitizePlainText(input.body), updatedById: actor.id } }); const version = await tx.articleRevision.count({ where: { articleId: id } }) + 1; await tx.articleRevision.create({ data: { organizationId: input.organizationId, articleId: id, actorId: actor.id, version, snapshot: JSON.parse(JSON.stringify(article)) } }); await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "UPDATE", resourceType: "Article", resourceId: id, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(article)) } }); return article; }); }
export async function actionArticle(actor: Actor, id: string, raw: unknown) { const input = articleActionInput.parse(raw); const permission = input.action === "archive" ? "article.archive" : input.action === "draft" ? "article.update" : "article.publish"; await authorizeOrganization(actor, input.organizationId, permission); const status: ArticleStatus = input.action === "publish" ? "PUBLISHED" : input.action === "schedule" ? "SCHEDULED" : input.action === "archive" ? "ARCHIVED" : "DRAFT"; const now = new Date(); return db.$transaction(async (tx) => { const before = await tx.article.findFirst({ where: { id, organizationId: input.organizationId } }); if (!before) throw new ApiError(404, "Berita tidak ditemukan."); if (status === "SCHEDULED" && (!input.scheduledAt || input.scheduledAt <= now)) throw new ApiError(422, "Jadwal publikasi harus di masa depan."); const article = await tx.article.update({ where: { id }, data: { status, scheduledAt: status === "SCHEDULED" ? input.scheduledAt : null, publishedAt: status === "PUBLISHED" ? now : before.publishedAt, archivedAt: status === "ARCHIVED" ? now : null, updatedById: actor.id } }); await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: status === "PUBLISHED" ? "APPROVE" : "UPDATE", resourceType: "Article", resourceId: id, before: JSON.parse(JSON.stringify(before)), after: JSON.parse(JSON.stringify(article)) } }); return article; }); }

export async function setPublicFollow(raw: unknown) { const input = followInput.parse(raw); const org = await db.organization.findFirst({ where: { id: input.organizationId, status: "ACTIVE", deletedAt: null } }); if (!org) throw new ApiError(404, "Organisasi tidak ditemukan."); const targetExists = input.type === "COMPETITION" ? await db.competition.findFirst({ where: { id: input.targetId, organizationId: input.organizationId, ...publicCompetitionWhere }, select: { id: true } }) : input.type === "CLUB" ? await db.club.findFirst({ where: { id: input.targetId, organizationId: input.organizationId, deletedAt: null, isActive: true }, select: { id: true } }) : await db.match.findFirst({ where: { id: input.targetId, organizationId: input.organizationId, publishedAt: { not: null }, status: { in: publicMatchStatuses } }, select: { id: true } }); if (!targetExists) throw new ApiError(404, "Target follow tidak tersedia untuk publik."); const relation = input.type === "COMPETITION" ? { competitionId: input.targetId } : input.type === "CLUB" ? { clubId: input.targetId } : { matchId: input.targetId }; if (!input.follow) { await db.publicFollow.deleteMany({ where: { organizationId: input.organizationId, anonymousKey: input.anonymousKey, type: input.type as PublicFollowType, targetId: input.targetId } }); return { following: false }; } await db.publicFollow.upsert({ where: { organizationId_anonymousKey_type_targetId: { organizationId: input.organizationId, anonymousKey: input.anonymousKey, type: input.type as PublicFollowType, targetId: input.targetId } }, update: relation, create: { organizationId: input.organizationId, anonymousKey: input.anonymousKey, type: input.type as PublicFollowType, targetId: input.targetId, ...relation } }); return { following: true }; }
export async function setNotificationPreference(raw: unknown) { const input = preferenceInput.parse(raw); return db.notificationPreference.upsert({ where: { organizationId_anonymousKey: { organizationId: input.organizationId, anonymousKey: input.anonymousKey } }, update: { enabled: input.enabled, eventTypes: input.eventTypes }, create: input }); }
export async function listNotifications(organizationId: string, anonymousKey: string) { const follows = await db.publicFollow.findMany({ where: { organizationId, anonymousKey }, select: { competitionId: true, clubId: true, matchId: true } }); const targets = { competitions: follows.flatMap((f) => f.competitionId ? [f.competitionId] : []), clubs: follows.flatMap((f) => f.clubId ? [f.clubId] : []), matches: follows.flatMap((f) => f.matchId ? [f.matchId] : []) }; const notifications = await db.notification.findMany({ where: { organizationId, publishedAt: { lte: new Date() }, OR: [{ competitionId: { in: targets.competitions } }, { clubId: { in: targets.clubs } }, { matchId: { in: targets.matches } }] }, orderBy: { publishedAt: "desc" }, take: 50 }); if (notifications.length) await db.notificationDelivery.createMany({ data: notifications.map((n) => ({ organizationId, notificationId: n.id, anonymousKey, status: "DELIVERED" as const, attempts: 1, deliveredAt: new Date() })), skipDuplicates: true }); const deliveries = await db.notificationDelivery.findMany({ where: { anonymousKey, notificationId: { in: notifications.map((n) => n.id) } }, select: { notificationId: true, readAt: true } }); const read = new Map(deliveries.map((d) => [d.notificationId, d.readAt])); return notifications.map((item) => ({ ...item, readAt: read.get(item.id) || null })); }
export async function markNotificationRead(organizationId: string, anonymousKey: string, id: string) { const result = await db.notificationDelivery.updateMany({ where: { organizationId, anonymousKey, notificationId: id }, data: { readAt: new Date() } }); if (!result.count) throw new ApiError(404, "Notifikasi tidak ditemukan."); return { read: true }; }
export async function createNotification(actor: Actor, raw: unknown) { const input = notificationInput.parse(raw); await authorizeOrganization(actor, input.organizationId, "notification.send"); if (input.competitionId && !await db.competition.findFirst({ where: { id: input.competitionId, organizationId: input.organizationId } })) throw new ApiError(422, "Kompetisi tidak berada dalam organisasi aktif."); if (input.clubId && !await db.club.findFirst({ where: { id: input.clubId, organizationId: input.organizationId } })) throw new ApiError(422, "Klub tidak berada dalam organisasi aktif."); if (input.matchId) { const match = await db.match.findFirst({ where: { id: input.matchId, organizationId: input.organizationId }, select: { status: true, publishedAt: true } }); if (!match || !match.publishedAt || match.status === "DRAFT") throw new ApiError(422, "Notifikasi tidak boleh dibuat untuk pertandingan draft atau belum dipublikasikan."); } return db.$transaction(async (tx) => { const notification = await tx.notification.upsert({ where: { organizationId_sourceKey: { organizationId: input.organizationId, sourceKey: input.sourceKey } }, update: {}, create: { ...input, title: sanitizePlainText(input.title), body: sanitizePlainText(input.body), publishedAt: new Date(), createdById: actor.id } }); await tx.auditLog.create({ data: { organizationId: input.organizationId, actorId: actor.id, action: "CREATE", resourceType: "Notification", resourceId: notification.id, after: JSON.parse(JSON.stringify(notification)) } }); return notification; }); }
