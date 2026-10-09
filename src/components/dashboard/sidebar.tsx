import Link from "next/link";
import { BarChart3, Building2, CalendarDays, LayoutDashboard, Settings, ShieldCheck, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const nav = [[LayoutDashboard, "Ringkasan", "/dashboard"], [Trophy, "Kompetisi", "/dashboard/kompetisi"], [Building2, "Klub", "/dashboard/klub"], [Users, "Pemain", "/dashboard/pemain"], [CalendarDays, "Pertandingan", "/dashboard/pertandingan"], [BarChart3, "Laporan", "/dashboard/laporan"], [ShieldCheck, "Akses & audit", "/dashboard/akses"], [Settings, "Pengaturan", "/dashboard/pengaturan"]] as const;

export function Sidebar() {
  return <aside className="hidden min-h-screen w-68 border-r bg-navy p-5 lg:block"><Logo className="px-2" /><nav className="mt-10 space-y-1">{nav.map(([Icon, label, href], index) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${index === 0 ? "bg-primary/10 text-primary" : "text-muted hover:bg-white/5 hover:text-white"}`}><Icon size={19} />{label}</Link>)}</nav><div className="mt-10 rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-[.15em] text-primary">Phase 0</p><p className="mt-2 text-xs leading-5 text-muted">Shell dashboard siap. Modul operasional diaktifkan bertahap.</p></div></aside>;
}
