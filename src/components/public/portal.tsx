import Link from "next/link";
import { CalendarDays, Radio, ShieldCheck } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed bg-white/[.02] px-6 py-12 text-center"><div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-white/5 text-muted"><ShieldCheck size={20} /></div><h3 className="font-display font-bold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p></div>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: { label: string; href: string } }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}<h2 className="font-display text-2xl font-extrabold tracking-tight">{title}</h2></div>{action && <Link className="text-sm font-bold text-primary hover:underline" href={action.href}>{action.label} →</Link>}</div>;
}

type PublicMatch = { id: string; status: string; kickoffAt: Date | null; homeScore: number; awayScore: number; competition: { name: string }; homeTeam: { club: { name: string; shortName: string; logoUrl?: string | null } }; awayTeam: { club: { name: string; shortName: string; logoUrl?: string | null } } };
const live = new Set(["LIVE_FIRST_HALF", "HALF_TIME", "LIVE_SECOND_HALF", "EXTRA_TIME", "PENALTY_SHOOTOUT"]);
const finished = new Set(["OFFICIAL", "FINISHED_PENDING_APPROVAL"]);

export function ClubMark({ name, logoUrl, size = "md" }: { name: string; logoUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const css = size === "lg" ? "size-20 text-xl" : size === "sm" ? "size-8 text-[10px]" : "size-11 text-xs";
  return <div className={`${css} grid shrink-0 place-items-center overflow-hidden rounded-full border bg-white/5 font-display font-extrabold text-primary`}>{logoUrl ? <span className="size-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${logoUrl})` }} role="img" aria-label={`Logo ${name}`} /> : name.slice(0, 2).toUpperCase()}</div>;
}

export function PublicMatchCard({ match }: { match: PublicMatch }) {
  const isLive = live.has(match.status); const showScore = isLive || finished.has(match.status);
  const time = match.kickoffAt ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(match.kickoffAt) : "Belum dijadwalkan";
  return <Link href={`/pertandingan/${match.id}`} className="group block rounded-2xl border bg-surface/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/40"><div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-muted"><span className="truncate">{match.competition.name}</span><span className={isLive ? "flex items-center gap-1 text-red-400" : ""}>{isLive && <Radio size={11} />}{isLive ? "Live" : time}</span></div><div className="space-y-3"><div className="flex items-center gap-3"><ClubMark name={match.homeTeam.club.name} logoUrl={match.homeTeam.club.logoUrl} size="sm" /><strong className="min-w-0 flex-1 truncate text-sm">{match.homeTeam.club.name}</strong><span className="font-display text-xl font-extrabold">{showScore ? match.homeScore : "–"}</span></div><div className="flex items-center gap-3"><ClubMark name={match.awayTeam.club.name} logoUrl={match.awayTeam.club.logoUrl} size="sm" /><strong className="min-w-0 flex-1 truncate text-sm">{match.awayTeam.club.name}</strong><span className="font-display text-xl font-extrabold">{showScore ? match.awayScore : "–"}</span></div></div></Link>;
}

export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="border-b bg-navy/50"><div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-primary">{eyebrow}</p><h1 className="mt-3 max-w-4xl font-display text-4xl font-extrabold tracking-[-.04em] sm:text-5xl">{title}</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">{description}</p></div></section>;
}

export function Freshness({ date, stale = false }: { date?: Date | null; stale?: boolean }) { return <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${stale ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "bg-white/[.03] text-muted"}`}><CalendarDays size={12} />{stale ? "Pembaruan live terlambat" : date ? `Diperbarui ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date)}` : "Menunggu data resmi"}</div>; }

export function StandingsTable({ rows }: { rows: Array<{ id: string; position: number; played: number; won: number; drawn: number; lost: number; goalDifference: number; points: number; adjustmentPoints: number; resolutionStatus: string; qualificationStatus: string; form: unknown; club: { name: string; slug: string; logoUrl: string | null } }> }) {
  return <div className="overflow-x-auto rounded-2xl border bg-surface/60"><table className="w-full min-w-[680px] text-sm"><thead className="bg-white/[.03] text-xs uppercase tracking-wider text-muted"><tr><th className="p-4 text-left">#</th><th className="p-4 text-left">Klub</th><th className="p-4">M</th><th className="p-4">M</th><th className="p-4">S</th><th className="p-4">K</th><th className="p-4">SG</th><th className="p-4">Form</th><th className="p-4">Poin</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="p-4"><span className={`inline-grid size-7 place-items-center rounded-lg font-bold ${row.qualificationStatus === "QUALIFIED" ? "bg-primary/15 text-primary" : row.qualificationStatus === "ELIMINATED" ? "bg-red-500/10 text-red-300" : "bg-white/5"}`}>{row.position}</span></td><td className="p-4"><Link className="flex items-center gap-3 font-bold hover:text-primary" href={`/klub/${row.club.slug}`}><ClubMark name={row.club.name} logoUrl={row.club.logoUrl} size="sm" />{row.club.name}</Link>{row.adjustmentPoints !== 0 && <small className="ml-11 block text-amber-300">Penyesuaian {row.adjustmentPoints > 0 ? "+" : ""}{row.adjustmentPoints}</small>}{row.resolutionStatus === "UNRESOLVED" && <small className="ml-11 block text-amber-300">Peringkat belum final</small>}</td><td className="p-4 text-center">{row.played}</td><td className="p-4 text-center">{row.won}</td><td className="p-4 text-center">{row.drawn}</td><td className="p-4 text-center">{row.lost}</td><td className="p-4 text-center">{row.goalDifference}</td><td className="p-4 text-center text-xs text-muted">{Array.isArray(row.form) ? row.form.slice(-5).join(" · ") : "–"}</td><td className="p-4 text-center font-display text-lg font-extrabold text-primary">{row.points}</td></tr>)}</tbody></table></div>;
}
