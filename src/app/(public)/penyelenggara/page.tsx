import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHero } from "@/components/public/portal";
import {
  listActiveRegions,
  listPublicOrganizers,
} from "@/modules/phase16/service";

type Query = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Query> };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const metadata: Metadata = {
  title: "Penyelenggara Sepak Bola Indonesia",
  description:
    "Profil publik penyelenggara dan kompetisi sepak bola yang telah melalui moderasi LIGA GOAL.",
  alternates: { canonical: "/penyelenggara" },
};

export default async function OrganizerDirectory({ searchParams }: Props) {
  const params = await searchParams;
  const [result, regions] = await Promise.all([
    listPublicOrganizers({
      q: first(params.q),
      province: first(params.province),
      city: first(params.city),
      page: first(params.page) || "1",
      pageSize: "12",
    }),
    listActiveRegions(),
  ]);
  const province = first(params.province);
  const cities =
    regions.provinces.find((item) => item.slug === province)?.children ?? [];
  return (
    <>
      <PageHero
        eyebrow="Direktori nasional"
        title="Penyelenggara terverifikasi"
        description="Hanya profil berstatus Published dari organisasi aktif yang ditampilkan."
      />
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <form
          role="search"
          className="grid gap-3 rounded-2xl border bg-surface/60 p-5 md:grid-cols-4"
        >
          <label className="md:col-span-2">
            <span className="mb-2 block text-xs font-bold uppercase text-muted">
              Cari penyelenggara
            </span>
            <input
              className="field"
              name="q"
              type="search"
              maxLength={80}
              defaultValue={first(params.q)}
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase text-muted">
              Provinsi
            </span>
            <select className="field" name="province" defaultValue={province}>
              <option value="">Semua provinsi</option>
              {regions.provinces.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-xs font-bold uppercase text-muted">
              Kabupaten/kota
            </span>
            <select
              className="field"
              name="city"
              defaultValue={first(params.city)}
              disabled={!province}
            >
              <option value="">Semua wilayah</option>
              {cities.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 md:col-span-4">
            <button className="btn-primary">Cari</button>
            <Link className="btn-secondary" href="/penyelenggara">
              Reset
            </Link>
          </div>
        </form>
        <p className="mt-8 text-sm text-muted">
          <strong className="text-white">{result.total}</strong> penyelenggara
          ditemukan
        </p>
        <section className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <Link
              key={item.id}
              href={`/penyelenggara/${item.publicSlug}`}
              className="rounded-2xl border bg-surface/60 p-6 hover:border-primary/40"
            >
              <h2 className="font-display text-xl font-bold">
                {item.displayName}
              </h2>
              <p className="mt-2 text-xs text-primary">
                {item.city?.name || item.province?.name || "Indonesia"}
              </p>
              <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted">
                {item.description ||
                  "Profil penyelenggara kompetisi sepak bola."}
              </p>
              <p className="mt-5 border-t pt-4 text-xs text-muted">
                {item.organization._count.competitionPublications} kompetisi
                publik
              </p>
            </Link>
          ))}
          {!result.items.length && (
            <div className="md:col-span-2 lg:col-span-3">
              <EmptyState
                title="Belum ada penyelenggara"
                description="Ubah filter atau kembali saat profil publik telah disetujui."
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
