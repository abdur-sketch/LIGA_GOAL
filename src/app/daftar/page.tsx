import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata = { title: "Daftar Organizer" };
export default function RegisterPage() { return <main className="min-h-screen p-6 sm:p-10"><Logo /><section className="mx-auto max-w-md py-16"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Self-service organizer</p><h1 className="mt-3 font-display text-4xl font-extrabold">Mulai kelola kompetisi.</h1><p className="mt-3 text-sm leading-6 text-muted">Daftar, verifikasi email, lalu buat workspace organisasi Anda.</p><RegisterForm /><Link href="/" className="mt-8 block text-center text-sm text-muted">← Portal publik</Link></section></main>; }
