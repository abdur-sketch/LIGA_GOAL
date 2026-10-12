import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, PageHero } from "@/components/public/portal";
import { getRegionDiscovery } from "@/modules/phase16/service";

type Props = { params: Promise<{ province: string; city: string }> };
async function load(province: string, city: string) {
  try {
    return await getRegionDiscovery(province, city, { pageSize: 24 });
  } catch {
    return null;
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { province, city } = await params;
  const data = await load(province, city);
  if (!data)
    return { title: "Wilayah tidak ditemukan", robots: { index: false } };
  return {
    title: `Kompetisi Sepak Bola ${data.city!.name}`,
    description: `Kompetisi sepak bola publik di ${data.city!.name}, ${data.province.name}.`,
    alternates: { canonical: `/wilayah/${province}/${city}` },
    robots: data.results.total
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}
export const revalidate = 60;
export default async function CityPage({ params }: Props) {
  const { province, city } = await params;
  const data = await load(province, city);
  if (!data) notFound();
  return (
    <>
      <PageHero
        eyebrow={data.province.name}
        title={`Kompetisi di ${data.city!.name}`}
        description={`${data.results.total} kompetisi publik ditemukan.`}
      />
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <Link className="text-sm text-primary" href={`/wilayah/${province}`}>
          ← Semua wilayah {data.province.name}
        </Link>
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {data.results.items.map((item) => (
            <Link
              key={item.id}
              href={`/kompetisi/${item.publication!.publicSlug}`}
              className="rounded-2xl border bg-surface/60 p-5"
            >
              <h2 className="font-display font-bold">{item.name}</h2>
              <p className="mt-3 text-sm text-muted">
                {item.organization.publicProfile?.displayName ||
                  item.organization.name}
              </p>
            </Link>
          ))}
          {!data.results.items.length && (
            <div className="md:col-span-3">
              <EmptyState
                title="Belum ada kompetisi publik"
                description="Konten draft dan nonaktif tidak ditampilkan."
              />
            </div>
          )}
        </section>
      </div>
    </>
  );
}
