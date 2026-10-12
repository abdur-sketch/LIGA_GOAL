import { Suspense } from "react";
import { InvitationResponse } from "@/components/organizer/invitation-response";

export default function InvitationPage() { return <main className="mx-auto min-h-screen max-w-lg p-6 py-24"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Undangan organisasi</p><h1 className="mt-3 font-display text-3xl font-bold">Bergabung ke workspace</h1><p className="mt-3 text-sm text-muted">Masuk dengan email penerima yang telah diverifikasi sebelum menerima undangan.</p><Suspense fallback={<p className="mt-8">Memuat…</p>}><InvitationResponse /></Suspense></main>; }
