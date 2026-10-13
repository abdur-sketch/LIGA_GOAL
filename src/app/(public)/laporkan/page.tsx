import { notFound } from "next/navigation";
import { PageHero } from "@/components/public/portal";
import { ReportAbuseForm } from "@/components/public/report-abuse-form";
type Props = { searchParams: Promise<{ type?: string; id?: string }> };
export const metadata = { title: "Laporkan konten", robots: { index: false, follow: false } };
export default async function ReportPage({ searchParams }: Props) { const query = await searchParams; const type = query.type === "competition" ? "COMPETITION" : query.type === "organizer" ? "ORGANIZER" : null; if (!type || !query.id) notFound(); return <><PageHero eyebrow="Trust & safety" title="Laporkan konten" description="Laporan ditinjau petugas berizin. Jangan kirim kata sandi, dokumen identitas, atau data sensitif di kolom ini."/><main className="mx-auto max-w-2xl px-5 py-10"><ReportAbuseForm targetType={type} targetId={query.id}/></main></>; }
