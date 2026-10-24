import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <Logo className="justify-center" />
        <p className="mt-10 text-xs font-extrabold uppercase tracking-[.2em] text-primary">404 · Tidak ditemukan</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Halaman tidak tersedia</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Tautan mungkin sudah berubah atau kompetisi belum dipublikasikan.</p>
        <Link href="/" className="btn-primary mt-6">Kembali ke beranda</Link>
      </div>
    </main>
  );
}
