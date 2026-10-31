import { GenericResults } from "@/components/public/generic-competition";
import { EmptyState, PageHero } from "@/components/public/portal";
import { listPublicGenericResults } from "@/modules/phase19/public";
export const metadata = { title: "Hasil & Peringkat", description: "Hasil resmi lomba umum, LCT, sekolah, seni, dan Gebyar." };
export const revalidate = 60;
export default async function ResultsPage() { const results = await listPublicGenericResults(); return <><PageHero eyebrow="Hasil resmi" title="Hasil & peringkat lomba" description="Nilai yang telah diverifikasi dan dipublikasikan oleh penyelenggara." /><section className="mx-auto max-w-7xl px-5 py-10 lg:px-8">{results.length ? <GenericResults results={results} /> : <EmptyState title="Hasil belum tersedia" description="Hasil resmi akan tampil setelah penilaian dipublikasikan." />}</section></>; }
