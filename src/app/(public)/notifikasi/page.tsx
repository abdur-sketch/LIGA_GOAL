import { PageHero } from "@/components/public/portal";
import { NotificationCenter } from "@/components/public/notification-center";
import { FollowDirectory } from "@/components/public/follow-directory";
import { listPublicClubs, listPublicCompetitions, listPublicMatches } from "@/modules/phase7/service";

export const metadata = { title: "Notifikasi", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [competitions, clubs, matchResult] = await Promise.all([listPublicCompetitions(), listPublicClubs(), listPublicMatches({ page: 1 })]);
  const organizations = Array.from(new Map(competitions.map((item) => [item.organizationId, { id: item.organizationId, name: item.organization.name }])).values());
  return <><PageHero eyebrow="In-app" title="Pusat notifikasi" description="Ikuti kompetisi, klub, dan pertandingan; lalu kelola preferensi serta riwayat pembaruan Anda." /><section className="mx-auto max-w-7xl px-5 py-10 lg:px-8"><FollowDirectory competitions={competitions.map((item) => ({ id: item.id, organizationId: item.organizationId, name: item.name }))} clubs={clubs.map((item) => ({ id: item.id, organizationId: item.organizationId, name: item.name }))} matches={matchResult.data.map((item) => ({ id: item.id, organizationId: item.organizationId, name: `${item.homeTeam.club.name} vs ${item.awayTeam.club.name}` }))} /><div className="mx-auto max-w-3xl"><NotificationCenter organizations={organizations} /></div></section></>;
}
