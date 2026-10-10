import Link from "next/link";
import { Bell, Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const links = [["Beranda", "/"], ["Pertandingan", "/pertandingan"], ["Kompetisi", "/kompetisi"], ["Klasemen", "/klasemen"], ["Statistik", "/statistik"], ["Klub", "/klub"], ["Pemain", "/pemain"], ["Berita", "/berita"]];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-5 xl:flex" aria-label="Navigasi utama">{links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-muted transition hover:text-white">{label}</Link>)}</nav>
        <div className="flex items-center gap-2"><Link href="/notifikasi" className="grid size-10 place-items-center rounded-xl border text-muted hover:text-primary" aria-label="Notifikasi"><Bell size={18} /></Link><Link href="/login" className="hidden rounded-xl border px-4 py-2.5 text-sm font-bold transition hover:bg-white/5 sm:block">Login pengelola</Link><details className="relative xl:hidden"><summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border" aria-label="Buka menu"><Menu size={20} /></summary><nav className="absolute right-0 top-12 grid w-56 rounded-2xl border bg-navy p-2 shadow-2xl">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-xl px-4 py-3 text-sm text-muted hover:bg-white/5 hover:text-white">{label}</Link>)}</nav></details></div>
      </div>
    </header>
  );
}
