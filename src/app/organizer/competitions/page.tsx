import { redirect } from "next/navigation";
import { MultiCompetitionManager } from "@/components/organizer/multi-competition-manager";
import { getApiActor } from "@/lib/auth/api";
import { getMultiCompetitionWorkspace } from "@/modules/phase19/service";

export const dynamic = "force-dynamic";

export default async function OrganizerCompetitionsPage() {
  const actor = await getApiActor();
  const workspace = await getMultiCompetitionWorkspace(actor);
  if (!workspace) redirect("/organizer/onboarding");
  const data = JSON.parse(JSON.stringify(workspace)) as typeof workspace;
  return <main className="mx-auto max-w-6xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Multi-competition workspace</p><h1 className="mt-2 font-display text-3xl font-bold">Kelola semua jenis lomba</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Sepak bola tetap berjalan dengan modul existing. LCT, lomba sekolah, seni, keagamaan, Gebyar, e-sports, dan format custom memakai fondasi peserta, sesi, rubrik, nilai, dan hasil generik.</p><div className="mt-8"><MultiCompetitionManager {...data} /></div></main>;
}
