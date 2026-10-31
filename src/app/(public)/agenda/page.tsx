import { EmptyState, PageHero } from "@/components/public/portal";
import { GenericSessionCard } from "@/components/public/generic-competition";
import { listPublicAgenda } from "@/modules/phase19/public";
export const metadata = { title: "Agenda Lomba", description: "Jadwal babak, sesi penjurian, presentasi, dan agenda perlombaan di PORTAL LOMBA." };
export const revalidate = 60;
export default async function AgendaPage() { const sessions = await listPublicAgenda(); return <><PageHero eyebrow="Agenda nasional" title="Jadwal & sesi lomba" description="Babak LCT, sesi penjurian, presentasi, dan agenda Gebyar yang telah diterbitkan penyelenggara." /><section className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sessions.map((session) => <GenericSessionCard key={session.id} session={session} />)}{!sessions.length && <div className="md:col-span-2 lg:col-span-3"><EmptyState title="Belum ada agenda publik" description="Agenda akan tampil setelah penyelenggara mempublikasikan sesi resmi." /></div>}</div></section></>; }
