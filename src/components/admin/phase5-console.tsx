"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, ShieldAlert, Sparkles } from "lucide-react";
import { useOrganization } from "./organization-context";

type Mode = "overview" | "standings" | "clubs" | "players" | "leaderboards" | "adjustments";
type Option = { id: string; name: string; competitionId?: string; seasonId?: string; stageId?: string };
type Lookups = { competitions: Option[]; seasons: Option[]; stages: Option[]; groups: Option[]; clubs: Option[] };
type Snapshot = Record<string, unknown> & {
  version: number;
  calculatedAt: string;
  standings: Array<Record<string, unknown>>;
  teamStatistics: Array<Record<string, unknown>>;
  playerStatistics: Array<Record<string, unknown>>;
  leaderboards: Array<Record<string, unknown>>;
};

const emptyLookups: Lookups = { competitions: [], seasons: [], stages: [], groups: [], clubs: [] };
const titles: Record<Mode, [string, string]> = {
  overview: ["Pusat statistik", "Ringkasan data resmi klub, pemain, dan leaderboard dalam satu snapshot."],
  standings: ["Klasemen resmi", "Peringkat deterministik dari hasil OFFICIAL dan penyesuaian poin terotorisasi."],
  clubs: ["Statistik klub", "Performa kandang/tandang, clean sheet, form, dan rekor beruntun."],
  players: ["Statistik pemain", "Penampilan dan event valid dari lineup terkonfirmasi tanpa menit rekaan."],
  leaderboards: ["Leaderboards", "Top scorer, assist, kartu, clean sheet, serangan dan pertahanan terbaik."],
  adjustments: ["Penyesuaian poin", "Deduksi atau bonus administratif dengan alasan dan audit approver."],
};

const value = (item: unknown) => String(item ?? "—").replaceAll("_", " ");
const object = (item: unknown) => item && typeof item === "object" ? item as Record<string, unknown> : {};
const list = (item: unknown) => Array.isArray(item) ? item as Array<Record<string, unknown>> : [];

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Permintaan gagal.");
  return body;
}

export function Phase5Console({ mode }: { mode: Mode }) {
  const { organizationId, loading: orgLoading } = useOrganization();
  const [lookups, setLookups] = useState(emptyLookups);
  const [competitionId, setCompetitionId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [stageId, setStageId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [caps, setCaps] = useState<Record<string, boolean>>({});
  const [stale, setStale] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adjustments, setAdjustments] = useState<Array<Record<string, unknown>>>([]);

  const seasons = useMemo(() => lookups.seasons.filter((item) => item.competitionId === competitionId), [lookups.seasons, competitionId]);
  const stages = useMemo(() => lookups.stages.filter((item) => item.seasonId === seasonId), [lookups.stages, seasonId]);
  const groups = useMemo(() => lookups.groups.filter((item) => item.stageId === stageId), [lookups.groups, stageId]);
  const query = useMemo(() => {
    const params = new URLSearchParams({ organizationId, competitionId, seasonId });
    if (stageId) params.set("stageId", stageId);
    if (groupId) params.set("groupId", groupId);
    return params;
  }, [organizationId, competitionId, seasonId, stageId, groupId]);

  useEffect(() => {
    if (!organizationId) return;
    api(`/api/admin/phase5/lookups?organizationId=${organizationId}`)
      .then(({ data }) => {
        setLookups(data);
        const initialCompetition = data.competitions[0]?.id || "";
        setCompetitionId((current) => current || initialCompetition);
        setSeasonId((current) => current || data.seasons.find((item: Option) => item.competitionId === initialCompetition)?.id || "");
      })
      .catch((error) => setMessage(error.message));
  }, [organizationId]);

  const load = useCallback(async () => {
    if (!organizationId || !competitionId || !seasonId) return;
    setLoading(true);
    setMessage("");
    try {
      const [{ data }, adjustmentResult] = await Promise.all([
        api(`/api/admin/phase5/statistics?${query}`),
        mode === "adjustments" ? api(`/api/admin/phase5/adjustments?${query}`) : Promise.resolve({ data: [] }),
      ]);
      setSnapshot(data.snapshot);
      setStale(data.stale);
      setCaps(data.capabilities || {});
      setAdjustments(adjustmentResult.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Statistik gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [competitionId, mode, organizationId, query, seasonId]);
  useEffect(() => {
    const timeout = window.setTimeout(load, 50);
    return () => window.clearTimeout(timeout);
  }, [load]);

  async function recompute() {
    setLoading(true);
    try {
      await api("/api/admin/phase5/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, competitionId, seasonId, stageId: stageId || undefined, groupId: groupId || undefined, idempotencyKey: crypto.randomUUID() }),
      });
      setMessage("Snapshot statistik berhasil dihitung ulang.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recompute gagal.");
      setLoading(false);
    }
  }

  async function addAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/admin/phase5/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, competitionId, seasonId, stageId: stageId || undefined, groupId: groupId || undefined, clubId: form.get("clubId"), amount: Number(form.get("amount")), reason: form.get("reason"), effectiveAt: new Date(String(form.get("effectiveAt"))).toISOString() }),
      });
      setMessage("Penyesuaian tersimpan. Jalankan recompute untuk menerbitkan snapshot baru.");
      event.currentTarget.reset();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Penyesuaian gagal."); }
  }

  const filteredPlayers = (snapshot?.playerStatistics || []).filter((row) => {
    const player = object(row.player);
    return `${player.displayName || ""} ${player.fullName || ""} ${object(row.club).name || ""}`.toLowerCase().includes(search.toLowerCase());
  });
  const [title, subtitle] = titles[mode];

  if (orgLoading) return <div className="p-8 text-sm text-muted">Memuat organisasi…</div>;
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Phase 5</p><h1 className="mt-2 text-3xl font-bold text-white">{title}</h1><p className="mt-2 max-w-3xl text-sm text-muted">{subtitle}</p></div>
          <div className="flex flex-wrap gap-2">
            {snapshot && caps["statistics.export"] && <><a className="btn-secondary" href={`/api/admin/phase5/export?${query}&format=xlsx`}><Download size={16}/> Excel</a><a className="btn-secondary" href={`/api/admin/phase5/export?${query}&format=pdf`}><Download size={16}/> PDF</a></>}
            {caps["statistics.recompute"] && <button className="btn-primary" onClick={recompute} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Recompute</button>}
          </div>
        </div>

        <section className="mt-6 grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-4">
          <Select label="Kompetisi" value={competitionId} onChange={(id) => { setCompetitionId(id); setSeasonId(lookups.seasons.find((item) => item.competitionId === id)?.id || ""); setStageId(""); setGroupId(""); }} options={lookups.competitions}/>
          <Select label="Musim" value={seasonId} onChange={(id) => { setSeasonId(id); setStageId(""); setGroupId(""); }} options={seasons}/>
          <Select label="Stage (opsional)" value={stageId} onChange={(id) => { setStageId(id); setGroupId(""); }} options={stages} optional/>
          <Select label="Grup (opsional)" value={groupId} onChange={setGroupId} options={groups} optional/>
        </section>

        {message && <div className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-white">{message}</div>}
        {stale && <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><ShieldAlert size={17}/> Sumber resmi berubah. Snapshot perlu dihitung ulang.</div>}
        {snapshot && <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted"><span className="rounded-full border px-3 py-1">Snapshot v{snapshot.version}</span><span className="rounded-full border px-3 py-1">Dihitung {new Date(snapshot.calculatedAt).toLocaleString("id-ID")}</span><span className="rounded-full border px-3 py-1 text-emerald-300">OFFICIAL</span></div>}

        {!snapshot && !loading ? <Empty onRecompute={caps["statistics.recompute"] ? recompute : undefined}/> : null}
        {snapshot && mode === "overview" && (
          <Overview snapshot={snapshot}/>
        )}
        {snapshot && mode === "standings" && (
          <Standings rows={snapshot.standings}/>
        )}
        {snapshot && mode === "clubs" && (
          <ClubStats rows={snapshot.teamStatistics}/>
        )}
        {mode === "players" && <><div className="relative mt-6 max-w-md"><Search className="absolute left-3 top-3 text-muted" size={17}/><input className="field pl-10" placeholder="Cari pemain atau klub…" value={search} onChange={(event) => setSearch(event.target.value)}/></div>{snapshot && <PlayerStats rows={filteredPlayers}/>}</>}
        {snapshot && mode === "leaderboards" && (
          <Leaderboards rows={snapshot.leaderboards} players={snapshot.playerStatistics} teams={snapshot.teamStatistics}/>
        )}
        {mode === "adjustments" && (
          <Adjustments items={adjustments} clubs={lookups.clubs} canAdjust={!!caps["standings.adjust"]} onSubmit={addAdjustment}/>
        )}
      </div>
    </main>
  );
}

function Select({ label, value: selected, onChange, options, optional = false }: { label: string; value: string; onChange: (id: string) => void; options: Option[]; optional?: boolean }) {
  return <label className="text-xs font-semibold text-muted">{label}<select className="field mt-2" value={selected} onChange={(event) => onChange(event.target.value)}><option value="">{optional ? "Semua" : "Pilih…"}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
function Empty({ onRecompute }: { onRecompute?: () => void }) { return <div className="mt-8 rounded-2xl border border-dashed bg-card p-12 text-center"><Sparkles className="mx-auto text-accent"/><h2 className="mt-4 text-lg font-bold text-white">Belum ada snapshot statistik</h2><p className="mt-2 text-sm text-muted">Pilih cakupan lalu terbitkan hasil perhitungan resmi pertama.</p>{onRecompute && <button className="btn-primary mt-5" onClick={onRecompute}>Hitung sekarang</button>}</div>; }

function Overview({ snapshot }: { snapshot: Snapshot }) {
  const leader = snapshot.standings[0];
  const scorer = snapshot.playerStatistics[0];
  const cards: Array<[string, string | number]> = [
    ["Klub terhitung", snapshot.standings.length], ["Pemain terhitung", snapshot.playerStatistics.length],
    ["Pemuncak klasemen", String(object(leader?.club).name || "—")], ["Top scorer", String(object(scorer?.player).displayName || object(scorer?.player).fullName || "—")],
  ];
  return <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, metric]) => <div key={String(label)} className="rounded-2xl border bg-card p-5"><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-3 text-2xl font-bold text-white">{value(metric)}</p></div>)}</div>;
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) { return <div className="mt-6 overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b bg-white/[.03] text-xs uppercase tracking-wider text-muted"><tr>{headers.map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y">{children}</tbody></table></div>; }
function Standings({ rows }: { rows: Array<Record<string, unknown>> }) { return <Table headers={["Pos", "Klub", "P", "W", "D", "L", "GF", "GA", "GD", "Pts", "Form"]}>{rows.map((row) => <tr key={String(row.id)} className="text-white"><td className="px-4 py-4 font-bold text-accent">{value(row.position)}</td><td className="px-4 py-4 font-semibold">{value(object(row.club).name)}</td>{["played","won","drawn","lost","goalsFor","goalsAgainst","goalDifference","points"].map((key) => <td key={key} className={`px-4 py-4 ${key === "points" ? "font-bold" : ""}`}>{value(row[key])}</td>)}<td className="px-4 py-4">{list(row.form).length ? list(row.form).map(value).join(" ") : Array.isArray(row.form) ? row.form.join(" ") : "—"}</td></tr>)}</Table>; }
function ClubStats({ rows }: { rows: Array<Record<string, unknown>> }) { return <Table headers={["Klub", "Main", "Menang", "Seri", "Kalah", "Gol", "Kebobolan", "CS", "Win %", "Streak W", "Unbeaten"]}>{rows.map((row) => <tr key={String(row.id)}><td className="px-4 py-4 font-semibold text-white">{value(object(row.club).name)}</td>{["played","won","drawn","lost","goalsFor","goalsAgainst","cleanSheets"].map((key) => <td key={key} className="px-4 py-4">{value(row[key])}</td>)}<td className="px-4 py-4">{Number(row.played) ? `${Math.round(Number(row.won) / Number(row.played) * 100)}%` : "0%"}</td><td className="px-4 py-4">{value(row.longestWinStreak)}</td><td className="px-4 py-4">{value(row.longestUnbeatenStreak)}</td></tr>)}</Table>; }
function PlayerStats({ rows }: { rows: Array<Record<string, unknown>> }) { return <Table headers={["Pemain", "Klub", "Apps", "Start", "Menit", "Gol", "Assist", "PK", "Kuning", "2nd Y", "Merah", "CS"]}>{rows.map((row) => <tr key={String(row.id)}><td className="px-4 py-4 font-semibold text-white">{value(object(row.player).displayName || object(row.player).fullName)}</td><td className="px-4 py-4">{value(object(row.club).name)}</td>{["appearances","starts","minutesPlayed","goals","assists","penaltyGoals","yellowCards","secondYellowCards","redCards","cleanSheets"].map((key) => <td key={key} className="px-4 py-4">{value(row[key])}</td>)}</tr>)}</Table>; }
function Leaderboards({ rows, players, teams }: { rows: Array<Record<string, unknown>>; players: Array<Record<string, unknown>>; teams: Array<Record<string, unknown>> }) {
  const playerMap = new Map(players.map((row) => [String(row.playerId), object(row.player).displayName || object(row.player).fullName]));
  const teamMap = new Map(teams.map((row) => [String(row.clubId), object(row.club).name]));
  return <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((board) => <section key={String(board.id)} className="rounded-2xl border bg-card p-5"><h2 className="font-bold capitalize text-white">{value(board.metric)}</h2><div className="mt-4 space-y-2">{list(board.entries).slice(0, 10).map((entry, index) => <div key={`${entry.playerId || entry.clubId}-${index}`} className="flex items-center justify-between rounded-xl bg-white/[.03] px-3 py-2"><span className="text-sm"><b className="mr-2 text-accent">{index + 1}</b>{value(playerMap.get(String(entry.playerId)) || teamMap.get(String(entry.clubId)))}</span><strong className="text-white">{value(entry.value)}</strong></div>)}</div></section>)}</div>;
}
function Adjustments({ items, clubs, canAdjust, onSubmit }: { items: Array<Record<string, unknown>>; clubs: Option[]; canAdjust: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <div className="mt-6 grid gap-5 xl:grid-cols-[380px_1fr]">{canAdjust && <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5"><h2 className="font-bold text-white">Adjustment baru</h2><label className="mt-4 block text-xs text-muted">Klub<select required name="clubId" className="field mt-2"><option value="">Pilih klub</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label><label className="mt-4 block text-xs text-muted">Jumlah poin<input required name="amount" type="number" min="-100" max="100" className="field mt-2" placeholder="-3 atau 2"/></label><label className="mt-4 block text-xs text-muted">Tanggal efektif<input required name="effectiveAt" type="datetime-local" className="field mt-2"/></label><label className="mt-4 block text-xs text-muted">Alasan<textarea required minLength={8} name="reason" className="field mt-2 min-h-24" placeholder="Keputusan disipliner…"/></label><button className="btn-primary mt-5 w-full" type="submit">Simpan adjustment</button></form>}<div className="overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left text-xs uppercase text-muted"><th className="p-4">Klub</th><th className="p-4">Poin</th><th className="p-4">Alasan</th><th className="p-4">Approver</th><th className="p-4">Efektif</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={String(item.id)}><td className="p-4 font-semibold text-white">{value(object(item.club).name)}</td><td className={`p-4 font-bold ${Number(item.amount) < 0 ? "text-red-300" : "text-emerald-300"}`}>{Number(item.amount) > 0 ? "+" : ""}{value(item.amount)}</td><td className="p-4">{value(item.reason)}</td><td className="p-4">{value(object(item.approvedBy).name)}</td><td className="p-4">{new Date(String(item.effectiveAt)).toLocaleDateString("id-ID")}</td></tr>)}</tbody></table></div></div>; }
