import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { publicCompetitionWhere } from "@/modules/phase7/service";
const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18);
  const [competitions, clubs, players, articles, matches] = await Promise.all([
    db.competition.findMany({ where: publicCompetitionWhere, select: { slug: true, updatedAt: true } }),
    db.club.findMany({ where: { deletedAt: null, isActive: true, competitionEntries: { some: { status: "APPROVED", competition: publicCompetitionWhere } } }, select: { slug: true, updatedAt: true } }),
    db.player.findMany({ where: { deletedAt: null, status: "ACTIVE", OR: [{ dateOfBirth: null }, { dateOfBirth: { lte: cutoff } }, { documents: { some: { type: "PARENTAL_CONSENT", isCurrent: true, verificationStatus: "APPROVED" } } }] }, select: { id: true, updatedAt: true }, take: 500 }),
    db.article.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, organizationId: { not: null }, organization: { status: "ACTIVE", deletedAt: null } }, select: { slug: true, updatedAt: true } }),
    db.match.findMany({ where: { publishedAt: { not: null }, competition: publicCompetitionWhere }, select: { id: true, updatedAt: true }, take: 1000 }),
  ]);
  const fixed = ["", "/pertandingan", "/kompetisi", "/klasemen", "/statistik", "/top-scorer", "/top-assist", "/klub", "/pemain", "/berita"].map((path) => ({ url: `${base}${path}`, lastModified: new Date() }));
  return [...fixed, ...competitions.map((item) => ({ url: `${base}/kompetisi/${item.slug}`, lastModified: item.updatedAt })), ...clubs.map((item) => ({ url: `${base}/klub/${item.slug}`, lastModified: item.updatedAt })), ...players.map((item) => ({ url: `${base}/pemain/${item.id}`, lastModified: item.updatedAt })), ...articles.map((item) => ({ url: `${base}/berita/${item.slug}`, lastModified: item.updatedAt })), ...matches.map((item) => ({ url: `${base}/pertandingan/${item.id}`, lastModified: item.updatedAt }))];
}
