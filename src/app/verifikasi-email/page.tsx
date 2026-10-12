import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata = { title: "Verifikasi Email" };
export default function VerifyEmailPage() { return <main className="min-h-screen p-6 sm:p-10"><Logo /><section className="mx-auto max-w-md py-20"><h1 className="font-display text-3xl font-bold">Verifikasi email</h1><p className="mt-3 text-sm text-muted">Tautan bersifat sekali pakai dan berlaku selama 30 menit.</p><Suspense fallback={<p className="mt-8 text-muted">Memuat…</p>}><VerifyEmailForm /></Suspense></section></main>; }
