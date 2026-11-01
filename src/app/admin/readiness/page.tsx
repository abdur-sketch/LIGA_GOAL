import { getApiActor } from "@/lib/auth/api";
import { releaseReadiness } from "@/modules/phase22/service";

const tones: Record<string, string> = { PASS: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", FAIL: "border-red-400/30 bg-red-400/10 text-red-200", BLOCKED: "border-amber-400/30 bg-amber-400/10 text-amber-100", "NOT VERIFIED": "border-slate-400/30 bg-slate-400/10 text-slate-200" };

export const dynamic = "force-dynamic";
export default async function ReadinessPage() {
  const data = await releaseReadiness(await getApiActor());
  return <main className="p-5 py-10 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Release evidence</p><h1 className="mt-2 font-display text-3xl font-bold">Production readiness center</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Status PASS hanya berasal dari pemeriksaan runtime atau bukti yang terikat commit. Provider, human UAT, pilot, dan backup tetap blocked sampai ada bukti eksternal yang sah.</p><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(data.gates).map(([key, gate]) => <article key={key} className={`rounded-2xl border p-5 ${tones[gate.status]}`}><div className="flex items-center justify-between gap-3"><h2 className="font-bold capitalize">{key}</h2><span className="rounded-full border px-2 py-1 text-[10px] font-extrabold">{gate.status}</span></div><p className="mt-3 text-xs leading-5 opacity-90">{gate.evidence}</p></article>)}</section><section className="mt-8 rounded-2xl border p-5"><h2 className="font-display text-xl font-bold">Blocker produksi</h2><ul className="mt-4 space-y-2 text-sm text-muted">{data.blockers.map((item) => <li key={item.key}><b className="text-white">{item.key}</b> — {item.evidence}</li>)}</ul></section><p className="mt-6 text-xs text-muted">Generated {new Date(data.generatedAt).toLocaleString("id-ID")}. Production decision: NO-GO.</p></main>;
}
