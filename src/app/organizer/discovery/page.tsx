import { redirect } from "next/navigation";
import { getApiActor } from "@/lib/auth/api";
import { PublicationSettings } from "@/components/organizer/publication-settings";
import { organizerOverview } from "@/modules/phase13/service";
import { discoveryWorkspace } from "@/modules/phase16/service";

export default async function OrganizerDiscoveryPage() { const actor = await getApiActor(); const overview = await organizerOverview(actor); if (!overview) redirect("/organizer/onboarding"); const data = await discoveryWorkspace(actor, overview.organization.id); return <main className="mx-auto max-w-5xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">National discovery</p><h1 className="mt-2 font-display text-3xl font-bold">Profil & publikasi</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Data tersimpan sebagai draft dan baru tampil kepada publik setelah diajukan serta disetujui moderator. Kontak organisasi internal tidak pernah disalin otomatis.</p><div className="mt-8"><PublicationSettings organizationId={overview.organization.id} profile={data.profile} competitions={data.competitions} regions={data.regions} /></div></main>; }
