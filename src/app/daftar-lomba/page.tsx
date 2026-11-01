import type { Metadata } from "next";
import { PublicRegistrationPortal } from "@/components/phase21/public-registration-portal";
import { PublicHeader } from "@/components/public/header";
import { listPublicRegistrationCompetitions } from "@/modules/phase21/service";
import { PUBLIC_REGISTRATION_PRIVACY_VERSION } from "@/modules/phase21/validation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pendaftaran Lomba | PORTAL LOMBA", description: "Daftar lomba individu, tim, instansi, dan cabang festival melalui portal resmi penyelenggara." };

export default async function PublicRegistrationPage() {
  const competitions = await listPublicRegistrationCompetitions();
  return <><PublicHeader /><main className="mx-auto max-w-6xl px-5 py-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Pendaftaran peserta</p><h1 className="mt-2 max-w-3xl font-display text-4xl font-extrabold">Daftar lomba secara aman</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Pilih lomba yang masih membuka pendaftaran. Data kontak dan dokumen hanya dapat dilihat penyelenggara berwenang.</p><div className="mt-8"><PublicRegistrationPortal competitions={JSON.parse(JSON.stringify(competitions))} privacyVersion={PUBLIC_REGISTRATION_PRIVACY_VERSION} /></div></main></>;
}
