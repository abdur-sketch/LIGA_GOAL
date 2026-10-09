import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  GitBranch,
  LandPlot,
  ListChecks,
  BarChart3,
  Medal,
  ShieldCheck,
  Trophy,
  UserRound,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";

const navigation = [
  [Building2, "Organisasi", "/admin/organizations"],
  [Trophy, "Kompetisi", "/admin/competitions"],
  [CalendarRange, "Musim", "/admin/seasons"],
  [UsersRound, "Klub", "/admin/clubs"],
  [LandPlot, "Venue", "/admin/venues"],
  [UserRoundCog, "Ofisial", "/admin/officials"],
  [UserRound, "Pemain", "/admin/players"],
  [ClipboardCheck, "Registrasi", "/admin/registrations"],
  [ListChecks, "Skuad", "/admin/squads"],
  [CalendarDays, "Fixture", "/admin/fixtures"],
  [UsersRound, "Grup", "/admin/groups"],
  [GitBranch, "Bracket", "/admin/brackets"],
  [CalendarRange, "Jadwal", "/admin/schedule"],
  [Activity, "Match Center", "/admin/matches"],
  [Trophy, "Klasemen", "/admin/standings"],
  [BarChart3, "Statistik", "/admin/statistics"],
  [Medal, "Leaderboard", "/admin/leaderboards"],
] as const;

export function AdminSidebar() {
  return (
    <aside className="hidden min-h-screen w-68 shrink-0 border-r bg-navy p-5 lg:block">
      <Logo className="px-2" />
      <p className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-muted">
        Management
      </p>
      <nav className="mt-3 space-y-1">
        {navigation.map(([Icon, label, href]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-muted transition hover:bg-white/5 hover:text-white"
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
      </nav>
      <Link
        href="/dashboard"
        className="mt-8 flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold text-muted hover:text-white"
      >
        <ShieldCheck size={18} />
        Dashboard utama
      </Link>
    </aside>
  );
}
