import { Leaderboard } from "@/components/public/leaderboard";
import { EmptyState, PageHero } from "@/components/public/portal";
import { getPublicStatistics } from "@/modules/phase7/service";
export const metadata = { title: "Top Assist" }; export const revalidate = 60;
export default async function TopAssistPage() { const snapshot = await getPublicStatistics(); return <><PageHero eyebrow="Leaderboard" title="Top assist" description="Pemberi assist terbanyak berdasarkan snapshot statistik resmi terbaru." /><section className="mx-auto max-w-3xl px-5 py-10 lg:px-8">{snapshot ? <Leaderboard rows={snapshot.playerStatistics} metric="assists" title={`${snapshot.competition.name} · ${snapshot.season.name}`} publishedAt={snapshot.publishedAt} /> : <EmptyState title="Belum ada data" description="Leaderboard belum dipublikasikan." />}</section></>; }
