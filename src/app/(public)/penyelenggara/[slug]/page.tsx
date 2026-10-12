import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EmptyState, PageHero } from "@/components/public/portal";
import {
  getPublicOrganizer,
  resolvePublicRedirect,
} from "@/modules/phase16/service";

type Props = { params: Promise<{ slug: string }> };
async function load(slug: string) {
  try {
    return await getPublicOrganizer(slug);
  } catch {
    return null;
  }
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = await load(slug);
  if (!item)
    return { title: "Penyelenggara tidak ditemukan", robots: { index: false } };
  return {
    title: item.displayName,
    description: item.description || `Profil publik ${item.displayName}.`,
    alternates: { canonical: `/penyelenggara/${item.publicSlug}` },
    openGraph: {
      title: item.displayName,
      description:
        item.description ||
        `Penyelenggara sepak bola di ${item.city?.name || item.province?.name || "Indonesia"}`,
    },
  };
}
export const revalidate = 60;

export default async function OrganizerProfile({ params }: Props) {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) {
    const target = await resolvePublicRedirect(`/penyelenggara/${slug}`);
    if (target) redirect(target);
    notFound();
  }
  const competitions = item.organization.competitions;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    name: item.displayName,
    description: item.description || undefined,
    url: `/penyelenggara/${item.publicSlug}`,
    areaServed: item.city?.name || item.province?.name || "Indonesia",
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c"),
        }}
      />
      <PageHero
        eyebrow={item.city?.name || item.province?.name || "Indonesia"}
        title={item.displayName}
        description={item.description || "Penyelenggara kompetisi sepak bola."}
      />
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <section className="rounded-2xl border bg-surface/60 p-6">
          <h2 className="font-display text-xl font-bold">Informasi publik</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted">
            {item.websiteUrl && (
              <a
                className="text-primary"
                href={item.websiteUrl}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                Situs resmi
              </a>
            )}
            {item.publicContactEmail && (
              <a href={`mailto:${item.publicContactEmail}`}>
                {item.publicContactEmail}
              </a>
            )}
            {item.publicContactPhone && <span>{item.publicContactPhone}</span>}
          </div>
        </section>
        <section className="mt-10">
          <h2 className="font-display text-2xl font-bold">Kompetisi</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {competitions.map((competition) => (
              <Link
                key={competition.id}
                href={`/kompetisi/${competition.publication!.publicSlug}`}
                className="rounded-2xl border bg-surface/60 p-5 hover:border-primary/40"
              >
                <h3 className="font-display font-bold">{competition.name}</h3>
                <p className="mt-3 line-clamp-3 text-sm text-muted">
                  {competition.description || "Detail kompetisi resmi."}
                </p>
                <p className="mt-4 text-xs text-primary">
                  {competition.status}
                  {competition.publication?.ageCategory
                    ? ` · ${competition.publication.ageCategory}`
                    : ""}
                </p>
              </Link>
            ))}
            {!competitions.length && (
              <div className="md:col-span-3">
                <EmptyState
                  title="Belum ada kompetisi publik"
                  description="Kompetisi yang disetujui moderator akan tampil di sini."
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
