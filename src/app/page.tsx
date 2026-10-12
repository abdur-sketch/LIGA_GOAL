import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { PublicHeader } from "@/components/public/header";
import {
  ClubMark,
  EmptyState,
  PublicMatchCard,
  SectionTitle,
  StandingsTable,
} from "@/components/public/portal";
import { getPublicHome } from "@/modules/phase7/service";
import { getNationalDiscoveryHome } from "@/modules/phase16/service";

export const revalidate = 60;

export default async function Home() {
  const [data, discovery] = await Promise.all([
    getPublicHome(),
    getNationalDiscoveryHome(),
  ]);
  const primaryMatches = data.live.length
    ? data.live
    : data.today.length
      ? data.today
      : data.upcoming;
  return (
    <>
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_20%,rgba(57,228,154,.16),transparent_36rem)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:py-28">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.2em] text-primary">
                Portal sepak bola Indonesia
              </p>
              <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[1.06] tracking-[-.055em] sm:text-6xl lg:text-7xl">
                Semua Liga,
                <br />
                <span className="text-primary">Satu Platform.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg">
                Ikuti pertandingan, kompetisi, klasemen, statistik, dan kabar
                sepak bola dari satu sumber data resmi.
              </p>
              <form action="/kompetisi" className="mt-8 flex max-w-xl gap-2">
                <input
                  aria-label="Cari kompetisi"
                  className="field"
                  name="q"
                  maxLength={80}
                  placeholder="Cari kompetisi di Indonesia"
                />
                <button className="btn-primary">Cari</button>
              </form>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/pertandingan" className="btn-primary h-12 px-6">
                  Lihat pertandingan <ArrowRight size={17} />
                </Link>
                <Link href="/daftar" className="btn-secondary h-12 px-6">
                  Daftarkan organisasi
                </Link>
                <Link href="/kompetisi" className="btn-secondary h-12 px-6">
                  Jelajahi kompetisi
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border bg-navy/85 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <SectionTitle
                eyebrow={
                  data.live.length ? "Sedang berlangsung" : "Match center"
                }
                title={
                  data.live.length
                    ? "Live sekarang"
                    : data.today.length
                      ? "Pertandingan hari ini"
                      : "Pertandingan mendatang"
                }
                action={{ label: "Lihat semua", href: "/pertandingan" }}
              />
              <div className="space-y-3">
                {primaryMatches.slice(0, 3).map((match) => (
                  <PublicMatchCard key={match.id} match={match} />
                ))}
                {primaryMatches.length === 0 && (
                  <EmptyState
                    title="Belum ada pertandingan"
                    description="Jadwal yang telah dipublikasikan akan tampil otomatis di sini."
                  />
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <SectionTitle
            eyebrow="Pilihan nasional"
            title="Kompetisi populer"
            action={{ label: "Semua kompetisi", href: "/kompetisi" }}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discovery.popular.map((item) => (
              <Link
                key={item.id}
                href={`/kompetisi/${item.publication!.publicSlug}`}
                className="rounded-2xl border bg-surface/60 p-5 transition hover:border-primary/40"
              >
                <div className="flex items-center gap-4">
                  <ClubMark name={item.name} logoUrl={item.logoUrl} />
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-bold">
                      {item.name}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.organization.publicProfile?.displayName ||
                        item.organization.name}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-between border-t pt-4 text-xs text-muted">
                  <span>
                    {item.publication?.city?.name ||
                      item.publication?.province?.name ||
                      "Indonesia"}
                  </span>
                  <span>{item._count.clubEntries} klub</span>
                </div>
              </Link>
            ))}
            {!discovery.popular.length && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  title="Belum ada kompetisi publik"
                  description="Kompetisi akan tampil setelah moderasi."
                />
              </div>
            )}
          </div>
        </section>
        <section className="border-y bg-surface-soft/40">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
            <SectionTitle
              eyebrow="Jelajahi"
              title="Wilayah & penyelenggara"
              action={{
                label: "Direktori penyelenggara",
                href: "/penyelenggara",
              }}
            />
            <div className="flex flex-wrap gap-2">
              {discovery.provinces.map((province) => (
                <Link
                  key={province.id}
                  href={`/wilayah/${province.slug}`}
                  className="rounded-full border px-4 py-2 text-sm text-muted hover:text-white"
                >
                  {province.name} · {province._count.competitionProvinces}
                </Link>
              ))}
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {discovery.organizers.map((item) => (
                <Link
                  key={item.id}
                  href={`/penyelenggara/${item.publicSlug}`}
                  className="rounded-xl border bg-surface/60 p-4"
                >
                  <strong>{item.displayName}</strong>
                  <p className="mt-1 text-xs text-muted">
                    {item.city?.name || item.province?.name || "Indonesia"}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <SectionTitle
                eyebrow="Snapshot resmi"
                title="Klasemen terkini"
                action={{ label: "Klasemen lengkap", href: "/klasemen" }}
              />
              {data.snapshot?.standings.length ? (
                <StandingsTable rows={data.snapshot.standings} />
              ) : (
                <EmptyState
                  title="Klasemen belum tersedia"
                  description="Snapshot resmi belum dipublikasikan."
                />
              )}
            </div>
            <div>
              <SectionTitle
                eyebrow="Performa"
                title="Top scorer"
                action={{ label: "Lihat ranking", href: "/top-scorer" }}
              />
              {data.snapshot?.playerStatistics.map((row, index) => (
                <Link
                  href={`/pemain/${row.player.id}`}
                  key={row.id}
                  className="mb-2 flex items-center gap-3 rounded-xl border p-3"
                >
                  <span>{index + 1}</span>
                  <span className="flex-1 text-sm font-bold">
                    {row.player.displayName || row.player.fullName}
                  </span>
                  <strong className="text-primary">{row.goals}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="border-t bg-navy/70">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center lg:px-8">
            <div className="flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Trophy />
              </span>
              <div>
                <h2 className="font-display text-xl font-extrabold">
                  Kelola kompetisi Anda.
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Bangun profil publik setelah data dan izin publikasi siap.
                </p>
              </div>
            </div>
            <Link className="btn-primary" href="/daftar">
              Mulai sebagai penyelenggara
            </Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between lg:px-8">
        <p>© 2026 LIGA GOAL</p>
        <p>Semua Liga, Satu Platform.</p>
      </footer>
    </>
  );
}
