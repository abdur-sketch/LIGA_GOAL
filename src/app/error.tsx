"use client";

import { Logo } from "@/components/brand/logo";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <Logo className="justify-center" />
        <p className="mt-10 text-xs font-extrabold uppercase tracking-[.2em] text-primary">Terjadi kendala</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Halaman gagal dimuat</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Data Anda tetap aman. Silakan coba memuat halaman ini kembali.</p>
        <button onClick={reset} className="btn-primary mt-6">Coba lagi</button>
      </div>
    </main>
  );
}
