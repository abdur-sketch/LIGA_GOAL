import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/organizer/onboarding-form";
import { getApiActor } from "@/lib/auth/api";
import { onboardingDefaults, organizerOverview } from "@/modules/phase13/service";

export default async function OrganizerOnboardingPage() { const actor = await getApiActor(); if (await organizerOverview(actor)) redirect("/organizer"); const versions = onboardingDefaults(); return <main className="mx-auto max-w-3xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Langkah 1 dari 1</p><h1 className="mt-2 font-display text-3xl font-bold">Buat organisasi Anda</h1><p className="mt-3 text-sm text-muted">Data dan persetujuan dicatat secara transaksional. Workspace hanya dibuat satu kali.</p><OnboardingForm {...versions} /></main>; }
