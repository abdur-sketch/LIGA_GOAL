import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHero } from "@/components/public/portal";
import {
  getRegionDiscovery,
  listActiveRegions,
} from "@/modules/phase16/service";

type Props = {
  params: Promise<{ province: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function load(province: string, query: Record<string, unknown> = {}) {
  try {
    return await getRegionDiscovery(province, undefined, query);
  } catch {
    return null;
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province } = await params;
  const data = await load(province);
  if (!data)
    return { title: "Wilayah tidak ditemukan", robots: { index: false } };
  return {
    title: `Kompetisi Sepak Bola ${data.province.name}`,
    description: `Temukan kompetisi sepak bola yang dipublikasikan di ${data.province.name}.`,
    alternates: { canonical: `/wilayah/${province}` },
    robots: data.results.total
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}
export const revalidate = 60;
export default async function ProvincePage({ params }: Props) {
  const { province } = await params;
  const [data, regions] = await Promise.all([
    load(province, { pageSize: 24 }),
    listActiveRegions(),
  ]);
  if (!data) notFound();
  const provinceRecord = regions.provinces.find(
    (item) => item.slug === province,
  )!;
  return (
    <>
      <PageHero
        eyebrow="Wilayah Indonesia"
        title={`Sepak bola di ${data.province.name}`}
        description={`${data.results.total} kompetisi publik ditemukan berdasarkan referensi wilayah tervalidasi.`}
      />
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <section>
          <h2 className="font-display text-2xl font-bold">Kabupaten & kota</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {provinceRecord.children.map((city) => (
              <Link
                className="rounded-full border px-3 py-2 text-xs text-muted hover:text-white"
                key={city.id}
                href={`/wilayah/${province}/${city.slug}`}
              >
                {city.name}
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {data.results.items.map((item) => (
            <Link
              key={item.id}
              href={`/kompetisi/${item.publication!.publicSlug}`}
              className="rounded-2xl border bg-surface/60 p-5"
            >
              <h2 className="font-display font-bold">{item.name}</h2>
              <p className="mt-2 text-xs text-primary">
                {item.publication?.city?.name || data.province.name}
              </p>
              <p className="mt-4 text-sm text-muted">
                {item.organization.publicProfile?.displayName ||
                  item.organization.name}
              </p>
            </Link>
          ))}
          {!data.results.items.length && (
            <div className="md:col-span-3">
              <EmptyState
                title="Belum ada kompetisi publik"
                description="Halaman tetap tersedia untuk navigasi, tetapi tidak diindeks sampai memiliki konten."
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
