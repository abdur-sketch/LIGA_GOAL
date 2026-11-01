import { redirect } from "next/navigation";
import { OrganizerOperations } from "@/components/phase21/organizer-operations";
import { getApiActor } from "@/lib/auth/api";
import { getOrganizerOrganization } from "@/modules/phase19/service";
import { getOrganizerOperations } from "@/modules/phase21/service";

export const dynamic = "force-dynamic";

export default async function OrganizerOperationsPage() {
  const actor = await getApiActor();
  const organization = await getOrganizerOrganization(actor);
  if (!organization) redirect("/organizer/onboarding");
  const operations = await getOrganizerOperations(actor, organization.id);
  return <main className="mx-auto max-w-7xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Pilot operations</p><h1 className="mt-2 font-display text-3xl font-bold">Juri, pendaftaran & persetujuan hasil</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Kelola akses juri per sesi, verifikasi peserta, dan jalankan dual approval sebelum hasil tampil ke publik.</p><div className="mt-8"><OrganizerOperations organizationId={organization.id} initialData={JSON.parse(JSON.stringify(operations))} /></div></main>;
}
