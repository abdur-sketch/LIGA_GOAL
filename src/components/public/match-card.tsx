import { Radio } from "lucide-react";

export function MatchCard({ live, home, away, homeScore, awayScore, time }: { live?: boolean; home: string; away: string; homeScore?: number; awayScore?: number; time: string }) {
  return (
    <article className="rounded-2xl border bg-surface/80 p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-center justify-between text-xs font-bold uppercase tracking-[.16em] text-muted"><span>Liga Nusantara</span>{live ? <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-red-400"><Radio size={12} /> Live · {time}</span> : <span>{time}</span>}</div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center"><div><div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-white/8 font-display font-bold">{home.slice(0, 2).toUpperCase()}</div><p className="text-sm font-semibold">{home}</p></div><div className="font-display text-3xl font-extrabold">{homeScore ?? "–"}<span className="mx-2 text-muted">:</span>{awayScore ?? "–"}</div><div><div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-primary/10 font-display font-bold text-primary">{away.slice(0, 2).toUpperCase()}</div><p className="text-sm font-semibold">{away}</p></div></div>
    </article>
  );
}
