import { FollowButton } from "./follow-button";

type Target = { id: string; organizationId: string; name: string };
export function FollowDirectory({ competitions, clubs, matches }: { competitions: Target[]; clubs: Target[]; matches: Target[] }) {
  const sections = [
    { title: "Kompetisi", type: "COMPETITION" as const, targets: competitions },
    { title: "Klub", type: "CLUB" as const, targets: clubs },
    { title: "Pertandingan", type: "MATCH" as const, targets: matches },
  ];
  return <div className="mb-10 grid gap-5 lg:grid-cols-3">{sections.map((section) => <section className="rounded-2xl border bg-surface/60 p-5" key={section.type}><h2 className="font-display text-lg font-extrabold">Ikuti {section.title}</h2><div className="mt-4 max-h-72 space-y-2 overflow-y-auto">{section.targets.map((target) => <div className="flex items-center gap-3 rounded-xl bg-white/[.03] p-3" key={target.id}><span className="min-w-0 flex-1 truncate text-sm font-bold">{target.name}</span><FollowButton organizationId={target.organizationId} type={section.type} targetId={target.id} /></div>)}{!section.targets.length && <p className="text-sm text-muted">Belum ada data publik.</p>}</div></section>)}</div>;
}
