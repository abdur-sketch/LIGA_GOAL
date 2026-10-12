import type { Metadata } from "next";
import Link from "next/link";
import { ClubMark, EmptyState, PageHero } from "@/components/public/portal";
import {
  listActiveRegions,
  searchPublicCompetitions,
} from "@/modules/phase16/service";

type Query = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Query> };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function queryInput(params: Query) {
  return {
    q: first(params.q),
    province: first(params.province),
    city: first(params.city),
    format: first(params.format),
    ageCategory: first(params.ageCategory),
    status: first(params.status),
    season: first(params.season),
    sort: first(params.sort) || "newest",
    page: first(params.page) || "1",
    pageSize: "12",
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.keys(params).length > 0;
  return {
    title: "Direktori Kompetisi Sepak Bola Indonesia",
    description:
      "Cari kompetisi sepak bola berdasarkan wilayah, kategori, status, musim, dan format.",
    alternates: { canonical: "/kompetisi" },
    robots: filtered
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

function pageHref(params: Query, page: number) {
  const next = new URLSearchParams();
  for (const [key, raw] of Object.entries(params)) {
    const value = first(raw);
    if (value && key !== "page") next.set(key, value);
  }
  next.set("page", String(page));
  return `/kompetisi?${next}`;
}

export default async function CompetitionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const [result, regions] = await Promise.all([
    searchPublicCompetitions(queryInput(params)),
    listActiveRegions(),
  ]);
  const selectedProvince = first(params.province);
  const cities =
    regions.provinces.find((item) => item.slug === selectedProvince)
      ?.children ?? [];
  return (
    <>
      <PageHero
        eyebrow="Direktori nasional"
        title="Temukan kompetisi sepak bola"
        description="Hanya kompetisi dan penyelenggara berstatus Published yang tampil. Cari berdasarkan data resmi sistem dan referensi wilayah tervalidasi."
      />
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <form
          role="search"
          className="grid gap-3 rounded-2xl border bg-surface/60 p-5 md:grid-cols-3 lg:grid-cols-4"
        >
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Cari kompetisi
            </span>
            <input
              className="field"
              type="search"
              name="q"
              defaultValue={first(params.q)}
              maxLength={80}
              placeholder="Nama kompetisi atau penyelenggara"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Provinsi
            </span>
            <select
              className="field"
              name="province"
              defaultValue={selectedProvince}
            >
              <option value="">Semua provinsi</option>
              {regions.provinces.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Kabupaten/kota
            </span>
            <select
              className="field"
              name="city"
              defaultValue={first(params.city)}
              disabled={!selectedProvince}
            >
              <option value="">Semua kabupaten/kota</option>
              {cities.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Format
            </span>
            <select
              className="field"
              name="format"
              defaultValue={first(params.format)}
            >
              <option value="">Semua format</option>
              <option value="SINGLE_ROUND_ROBIN">Satu putaran</option>
              <option value="DOUBLE_ROUND_ROBIN">Dua putaran</option>
              <option value="KNOCKOUT">Gugur</option>
              <option value="GROUP_AND_KNOCKOUT">Grup & gugur</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Kategori usia
            </span>
            <input
              className="field"
              name="ageCategory"
              defaultValue={first(params.ageCategory)}
              maxLength={40}
              placeholder="Contoh: U-17"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Status
            </span>
            <select
              className="field"
              name="status"
              defaultValue={first(params.status)}
            >
              <option value="">Semua status</option>
              <option value="REGISTRATION">Pendaftaran</option>
              <option value="ONGOING">Berlangsung</option>
              <option value="COMPLETED">Selesai</option>
              <option value="ARCHIVED">Arsip</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
              Urutkan
            </span>
            <select
              className="field"
              name="sort"
              defaultValue={first(params.sort) || "newest"}
            >
              <option value="newest">Terbaru</option>
              <option value="upcoming">Segera dimulai</option>
              <option value="popular">Populer</option>
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-3 lg:col-span-4">
            <button className="btn-primary" type="submit">
              Terapkan pencarian
            </button>
            <Link className="btn-secondary" href="/kompetisi">
              Reset
            </Link>
          </div>
        </form>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            <strong className="text-white">{result.total}</strong> kompetisi
            ditemukan
          </p>
          {regions.dataset && (
            <p className="text-xs text-muted">
              Wilayah: {regions.dataset.sourceVersion}
            </p>
          )}
        </div>
        <section
          className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-label="Hasil kompetisi"
        >
          {result.items.map((item) => (
            <Link
              href={`/kompetisi/${item.publication!.publicSlug}`}
              key={item.id}
              className="rounded-2xl border bg-surface/60 p-6 transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <div className="flex items-center gap-4">
                <ClubMark name={item.name} logoUrl={item.logoUrl} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-extrabold">
                    {item.name}
                  </h2>
                  <p className="mt-1 truncate text-xs text-muted">
                    {item.organization.publicProfile?.displayName ||
                      item.organization.name}
                  </p>
                </div>
              </div>
              <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted">
                {item.description ||
                  "Informasi kompetisi, pertandingan, klasemen, dan statistik resmi."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
                  {item.status}
                </span>
                {item.publication?.ageCategory && (
                  <span className="rounded-full bg-white/5 px-2.5 py-1">
                    {item.publication.ageCategory}
                  </span>
                )}
                <span className="rounded-full bg-white/5 px-2.5 py-1">
                  {item.publication?.city?.name ||
                    item.publication?.province?.name ||
                    "Indonesia"}
                </span>
              </div>
              <div className="mt-5 flex gap-4 border-t pt-4 text-xs text-muted">
                <span>{item._count.clubEntries} klub</span>
                <span>{item._count.matches} pertandingan</span>
              </div>
            </Link>
          ))}
          {!result.items.length && (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState
                title="Tidak ada kompetisi yang cocok"
                description="Ubah kata kunci atau filter. Konten draft, pending, unpublished, dan suspended tidak pernah masuk hasil."
              />
            </div>
          )}
        </section>
        {result.pageCount > 1 && (
          <nav
            aria-label="Pagination kompetisi"
            className="mt-8 flex items-center justify-center gap-3"
          >
            <Link
              aria-disabled={result.page <= 1}
              className={`btn-secondary ${result.page <= 1 ? "pointer-events-none opacity-40" : ""}`}
              href={pageHref(params, result.page - 1)}
            >
              Sebelumnya
            </Link>
            <span className="text-sm text-muted">
              Halaman {result.page} dari {result.pageCount}
            </span>
            <Link
              aria-disabled={result.page >= result.pageCount}
              className={`btn-secondary ${result.page >= result.pageCount ? "pointer-events-none opacity-40" : ""}`}
              href={pageHref(params, result.page + 1)}
            >
              Berikutnya
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
