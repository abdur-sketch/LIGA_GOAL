import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GenericResults, GenericSessionCard } from "@/components/public/generic-competition";
import { ClubMark, EmptyState, Freshness, PublicMatchCard, SectionTitle, StandingsTable } from "@/components/public/portal";
import { getPublicCompetition } from "@/modules/phase7/service";
import { resolvePublicRedirect } from "@/modules/phase16/service";
import { genericLabels } from "@/modules/phase19/catalog";

type Props = { params: Promise<{ slug: string }> };
async function competitionOrNull(slug: string) { try { return await getPublicCompetition(slug); } catch { return null; } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params; const result = await competitionOrNull(slug);
  if (!result) return { title: "Kompetisi tidak ditemukan", robots: { index: false } };
  const { competition } = result;
  const description = competition.description || `Jadwal, peserta, dan hasil resmi ${competition.name}.`;
  return { title: competition.name, description, alternates: { canonical: `/kompetisi/${slug}` }, openGraph: { title: competition.name, description }, twitter: { card: "summary_large_image", title: competition.name } };
}

export const revalidate = 60;

export default async function CompetitionDetail({ params }: Props) {
  const { slug } = await params; const result = await competitionOrNull(slug);
  if (!result) { const target = await resolvePublicRedirect(`/kompetisi/${slug}`); if (target) redirect(target); notFound(); }
  const { competition, snapshot } = result;
  const kind = competition.genericProfile?.kind ?? "FOOTBALL";
  const isFootball = kind === "FOOTBALL";
  const labels = genericLabels(kind);
  const regionPath = competition.publication?.city ? `/wilayah/${competition.publication.province?.slug}/${competition.publication.city.slug}` : competition.publication?.province ? `/wilayah/${competition.publication.province.slug}` : null;
  const jsonLd = { "@context": "https://schema.org", "@type": "Event", name: competition.name, description: competition.description || undefined, eventStatus: "https://schema.org/EventScheduled", organizer: { "@type": "Organization", name: competition.organization.name }, location: competition.publication?.city?.name || competition.publication?.province?.name || competition.location || "Indonesia", startDate: competition.startsAt?.toISOString(), endDate: competition.endsAt?.toISOString() };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }} />
    <section className="border-b bg-navy/60"><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="flex flex-col gap-6 sm:flex-row sm:items-center"><ClubMark name={competition.name} logoUrl={competition.logoUrl} size="lg" /><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-primary">{competition.organization.publicProfile?.publicSlug ? <Link href={`/penyelenggara/${competition.organization.publicProfile.publicSlug}`}>{competition.organization.name}</Link> : competition.organization.name}</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">{competition.name}</h1><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{competition.genericProfile?.template?.name || kind}</span><span className="rounded-full bg-white/5 px-3 py-1">{competition.status}</span><span className="rounded-full bg-white/5 px-3 py-1">{regionPath ? <Link href={regionPath}>{competition.publication?.city?.name || competition.publication?.province?.name}</Link> : competition.location || "Indonesia"}</span></div>{competition.publication && <Link className="mt-3 inline-block text-xs text-red-300" href={`/laporkan?type=competition&id=${competition.publication.id}`}>Laporkan kompetisi</Link>}</div></div></div></section>
    <div className="mx-auto max-w-7xl space-y-14 px-5 py-12 lg:px-8">
      <section id="ringkasan" className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border bg-surface/60 p-6"><SectionTitle title="Tentang kompetisi" /><p className="whitespace-pre-line text-sm leading-7 text-muted">{competition.description || "Deskripsi kompetisi belum tersedia."}</p></div><div className="rounded-2xl border bg-surface/60 p-6"><SectionTitle title="Regulasi publik" /><p className="whitespace-pre-line text-sm leading-7 text-muted">{competition.regulations || "Regulasi publik belum ditambahkan."}</p></div></section>
      {isFootball ? <FootballSections competition={competition} snapshot={snapshot} /> : <GenericSections competition={competition} labels={labels} />}
      <section id="berita"><SectionTitle title="Berita & pengumuman" /><div className="grid gap-4 md:grid-cols-3">{competition.articles.map((article) => <Link href={`/berita/${article.slug}`} className="rounded-xl border bg-surface/60 p-5" key={article.id}><p className="text-xs font-bold text-gold">{article.category}</p><h3 className="mt-2 font-display font-bold">{article.title}</h3></Link>)}{!competition.articles.length && <EmptyState title="Belum ada pengumuman" description="Pengumuman resmi penyelenggara akan tampil di sini." />}</div></section>
    </div>
  </>;
}

type CompetitionData = NonNullable<Awaited<ReturnType<typeof competitionOrNull>>>["competition"];
type SnapshotData = NonNullable<Awaited<ReturnType<typeof competitionOrNull>>>["snapshot"];

function FootballSections({ competition, snapshot }: { competition: CompetitionData; snapshot: SnapshotData }) {
  return <>
    <section id="peserta"><SectionTitle title="Klub peserta" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{competition.clubEntries.map((entry) => <Link href={`/klub/${entry.club.slug}`} key={entry.id} className="flex items-center gap-3 rounded-xl border bg-surface/60 p-4"><ClubMark name={entry.club.name} logoUrl={entry.club.logoUrl} size="sm" /><span className="text-sm font-bold">{entry.club.name}</span></Link>)}</div></section>
    <section id="agenda"><SectionTitle title="Jadwal & hasil pertandingan" action={{ label: "Match center", href: `/pertandingan?competition=${competition.id}` }} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{competition.matches.slice(0, 9).map((match) => <PublicMatchCard key={match.id} match={match} />)}{!competition.matches.length && <EmptyState title="Belum ada jadwal" description="Pertandingan terpublikasi akan tampil di sini." />}</div></section>
    <section id="hasil"><div className="mb-5 flex items-center justify-between"><SectionTitle title="Klasemen resmi" /><Freshness date={snapshot?.publishedAt} /></div>{snapshot?.standings.length ? <StandingsTable rows={snapshot.standings} /> : <EmptyState title="Belum ada klasemen" description="Snapshot resmi belum dipublikasikan." />}</section>
  </>;
}

function GenericSections({ competition, labels }: { competition: CompetitionData; labels: ReturnType<typeof genericLabels> }) {
  return <>
    <section id="peserta"><SectionTitle title={labels.participants} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{competition.genericEntries.map((entry) => <article key={entry.id} className="flex items-center gap-3 rounded-xl border bg-surface/60 p-4"><ClubMark name={entry.participant.name} logoUrl={entry.participant.logoUrl} size="sm" /><div><span className="text-sm font-bold">{entry.entryName || entry.participant.displayName || entry.participant.name}</span><p className="text-xs text-muted">{entry.participant.type}{entry.participant.institution ? ` · ${entry.participant.institution}` : ""}</p></div></article>)}{!competition.genericEntries.length && <EmptyState title={`Belum ada ${labels.participant.toLowerCase()}`} description="Peserta yang disetujui akan tampil di sini." />}</div></section>
    <section id="agenda"><SectionTitle title={labels.sessions} action={{ label: "Semua agenda", href: "/agenda" }} /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{competition.genericSessions.map((session) => <GenericSessionCard key={session.id} session={session} />)}{!competition.genericSessions.length && <EmptyState title="Belum ada agenda" description="Sesi yang diterbitkan akan tampil di sini." />}</div></section>
    <section id="hasil"><SectionTitle title={labels.result} action={{ label: "Semua hasil", href: "/hasil" }} />{competition.genericResults.length ? <GenericResults results={competition.genericResults} /> : <EmptyState title="Hasil belum tersedia" description="Nilai dan peringkat resmi akan tampil setelah dipublikasikan." />}</section>
  </>;
}
