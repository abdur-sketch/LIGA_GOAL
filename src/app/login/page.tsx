import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Masuk" };

export default function LoginPage() {
  return <main className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]"><section className="flex flex-col p-6 sm:p-10"><Logo /><div className="m-auto w-full max-w-md py-16"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Area pengelola</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Selamat datang kembali.</h1><p className="mt-3 text-sm leading-6 text-muted">Masuk menggunakan akun organisasi yang telah diverifikasi.</p><Suspense fallback={<div className="mt-8 h-72 animate-pulse rounded-2xl bg-white/5" />}><LoginForm /></Suspense><p className="mt-7 text-center text-xs text-muted">Belum memiliki akses? Hubungi administrator organisasi Anda.</p></div><Link href="/" className="text-sm text-muted hover:text-white">← Kembali ke portal publik</Link></section><aside className="relative hidden overflow-hidden border-l bg-surface-soft lg:block"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(57,228,154,.18),transparent_38%)]" /><div className="relative flex h-full flex-col justify-end p-14"><div className="max-w-lg rounded-3xl border bg-background/55 p-8 backdrop-blur-xl"><p className="font-display text-2xl font-bold leading-snug">“Satu sumber data untuk setiap keputusan kompetisi.”</p><p className="mt-4 text-sm leading-6 text-muted">Akses dilindungi dengan sesi aman, hak akses berbasis peran, dan pencatatan audit.</p></div></div></aside></main>;
}
