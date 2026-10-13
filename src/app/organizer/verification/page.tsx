import { redirect } from "next/navigation";
import { VerificationForm } from "@/components/organizer/verification-form";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";
export default async function OrganizerVerificationPage() { const data = await organizerOverview(await getApiActor()); if (!data) redirect("/organizer/onboarding"); return <main className="mx-auto max-w-3xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Organizer trust</p><h1 className="mt-2 font-display text-3xl font-bold">Ajukan verifikasi</h1><p className="mt-3 text-sm text-muted">Verifikasi identitas organisasi terpisah dari persetujuan publikasi profil atau kompetisi. Bukti hanya dapat dilihat petugas berizin.</p><VerificationForm organizationId={data.organization.id}/></main>; }
