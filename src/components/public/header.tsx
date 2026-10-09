import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const links = [["Kompetisi", "/kompetisi"], ["Pertandingan", "/pertandingan"], ["Klasemen", "/klasemen"], ["Statistik", "/statistik"]];

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigasi utama">{links.map(([label, href]) => <Link key={href} href={href} className="text-sm font-medium text-muted transition hover:text-white">{label}</Link>)}</nav>
        <div className="flex items-center gap-3"><Link href="/login" className="hidden rounded-xl border px-4 py-2.5 text-sm font-bold transition hover:bg-white/5 sm:block">Masuk</Link><button className="grid size-10 place-items-center rounded-xl border md:hidden" aria-label="Buka menu"><Menu size={20} /></button></div>
      </div>
    </header>
  );
}
