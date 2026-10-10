"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RefreshCw, Search } from "lucide-react";
import { useOrganization } from "./organization-context";

export type Phase6Mode = "transfers" | "transfer-windows" | "availability" | "injuries" | "discipline" | "suspensions";
type Row = Record<string, unknown>;
type Option = { id: string; name?: string; fullName?: string; competitionId?: string; seasonId?: string; activeClubId?: string | null };
type Lookups = { players: Option[]; clubs: Option[]; competitions: Option[]; seasons: Option[]; windows: Option[]; capabilities: Record<string, boolean> };

const emptyLookups: Lookups = { players: [], clubs: [], competitions: [], seasons: [], windows: [], capabilities: {} };
const copy: Record<Phase6Mode, [string, string]> = {
  transfers: ["Transfer pemain", "Workflow transfer terkontrol, approval berurutan, dan riwayat perubahan yang utuh."],
  "transfer-windows": ["Jendela transfer", "Atur periode registrasi dan batas waktu transfer setiap musim."],
  availability: ["Availability pemain", "Satu sumber status ketersediaan untuk lineup dan operasional pertandingan."],
  injuries: ["Cedera & medis", "Catatan medis privat, progres pemulihan, dan medical clearance terotorisasi."],
  discipline: ["Disiplin", "Kasus kartu, keputusan, penalti, dan banding dengan jejak audit."],
  suspensions: ["Suspensi", "Match-ban otomatis maupun manual serta pertandingan yang telah dijalani."],
};

const text = (value: unknown) => String(value ?? "—").replaceAll("_", " ");
const object = (value: unknown) => value && typeof value === "object" ? value as Row : {};
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "—";

async function api(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Permintaan gagal.");
  return body;
}

export function Phase6Console({ mode }: { mode: Phase6Mode }) {
  const { organizationId, loading: organizationLoading } = useOrganization();
  const [lookups, setLookups] = useState(emptyLookups);
  const [rows, setRows] = useState<Row[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [meta, setMeta] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [title, subtitle] = copy[mode];

  const query = useMemo(() => {
    const params = new URLSearchParams({ organizationId, page: String(page), pageSize: "20" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return params.toString();
  }, [organizationId, page, search, status]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setMessage("");
    try {
      const [lookupResult, result] = await Promise.all([
        api(`/api/admin/phase6/lookups?organizationId=${organizationId}`),
        api(`/api/admin/phase6/${mode}?${query}`),
      ]);
      setLookups(lookupResult.data);
      setRows(result.data || []);
      setCapabilities(result.capabilities || {});
      setMeta(result.meta || { page: 1, total: result.data?.length || 0, totalPages: 1 });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [mode, organizationId, query]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const value = (key: string) => String(form.get(key) || "");
    let body: Row;
    if (mode === "transfers") body = { organizationId, competitionId: value("competitionId"), seasonId: value("seasonId"), playerId: value("playerId"), sourceClubId: value("sourceClubId") || null, destinationClubId: value("destinationClubId") || null, transferWindowId: value("transferWindowId") || null, type: value("type"), effectiveAt: value("effectiveAt") ? new Date(value("effectiveAt")).toISOString() : null, supportingDocs: [], idempotencyKey: crypto.randomUUID() };
    else if (mode === "transfer-windows") body = { organizationId, competitionId: value("competitionId"), seasonId: value("seasonId"), name: value("name"), opensAt: new Date(value("opensAt")).toISOString(), closesAt: new Date(value("closesAt")).toISOString(), registrationDeadline: value("registrationDeadline") ? new Date(value("registrationDeadline")).toISOString() : null, status: value("status"), rules: {} };
    else if (mode === "availability") body = { organizationId, playerId: value("playerId"), status: value("status"), reason: value("reason"), publicNote: value("publicNote") || null, publicApproved: form.get("publicApproved") === "on", startsAt: new Date(value("startsAt")).toISOString(), endsAt: value("endsAt") ? new Date(value("endsAt")).toISOString() : null };
    else if (mode === "injuries") body = { organizationId, playerId: value("playerId"), injuryDate: new Date(value("injuryDate")).toISOString(), estimatedReturn: value("estimatedReturn") ? new Date(value("estimatedReturn")).toISOString() : null, diagnosis: value("diagnosis") || null, medicalNotes: value("medicalNotes") || null, publicNote: value("publicNote") || null, publicApproved: form.get("publicApproved") === "on" };
    else if (mode === "suspensions") body = { organizationId, competitionId: value("competitionId"), seasonId: value("seasonId"), playerId: value("playerId"), reason: value("reason"), effectiveAt: new Date(value("effectiveAt")).toISOString(), endsAt: value("endsAt") ? new Date(value("endsAt")).toISOString() : null, matchBans: value("matchBans") ? Number(value("matchBans")) : null };
    else body = { organizationId, competitionId: value("competitionId"), seasonId: value("seasonId"), playerId: value("playerId"), matchId: null, eventId: null, summary: value("summary") };
    try {
      await api(`/api/admin/phase6/${mode}?organizationId=${organizationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setShowForm(false);
      formElement.reset();
      await load();
      setMessage("Data berhasil disimpan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data gagal disimpan.");
    }
  }

  async function rowAction(row: Row, action: string) {
    let body: Row = {};
    if (mode === "injuries" && action === "progress") {
      const next = window.prompt("Status berikutnya: OPEN, RECOVERING, atau CLOSED", "RECOVERING");
      if (!next) return;
      body = { expectedVersion: row.version, status: next, privateNotes: window.prompt("Catatan medis privat (opsional)") || null, publicNote: null };
    } else if (mode === "injuries" && action === "clearance") {
      if (!window.confirm("Terbitkan medical clearance untuk pemain ini?")) return;
      body = { expectedVersion: row.version, clearedAt: new Date().toISOString(), notes: window.prompt("Catatan clearance (opsional)") || null };
    } else if (mode === "discipline" && action === "decision") {
      const reason = window.prompt("Alasan keputusan (minimal 8 karakter)");
      if (!reason || reason.length < 8) return;
      const matchBans = Number(window.prompt("Jumlah match-ban", "1") || 1);
      body = { type: "MATCH_BAN", reason, matchBans, startsAt: new Date().toISOString(), endsAt: null, pointPenalty: null };
    } else if (mode === "discipline" && action === "appeal") {
      const reason = window.prompt("Alasan banding (minimal 8 karakter)");
      if (!reason || reason.length < 8) return;
      body = { reason };
    } else return;
    try {
      await api(`/api/admin/phase6/${mode}/${row.id}/${action}?organizationId=${organizationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load();
      setMessage("Tindakan berhasil diproses.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Tindakan gagal."); }
  }

  if (organizationLoading) return <div className="p-8 text-sm text-muted">Memuat organisasi…</div>;
  const createPermission = mode === "transfers" ? "transfer.request" : mode === "transfer-windows" ? "transfer_window.manage" : mode === "availability" ? "availability.manage" : mode === "injuries" ? "injury.manage" : mode === "discipline" ? "discipline.manage" : "suspension.manage";
  const canCreate = capabilities[createPermission] ?? lookups.capabilities[createPermission] ?? false;
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-[1500px]">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Phase 6 · Player Operations</p><h1 className="mt-2 text-3xl font-bold text-white">{title}</h1><p className="mt-2 max-w-3xl text-sm text-muted">{subtitle}</p></div><div className="flex gap-2"><button onClick={load} className="btn-secondary"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> Muat ulang</button>{canCreate && <button onClick={() => setShowForm((open) => !open)} className="btn-primary"><Plus size={16}/> Tambah</button>}</div></header>

    <section className="mt-6 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-muted" size={17}/><input className="field pl-10" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari pemain…"/></label><select className="field sm:max-w-64" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Semua status</option>{statuses(mode).map((item) => <option key={item} value={item}>{text(item)}</option>)}</select></section>
    {message && <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-white"><AlertTriangle size={16}/>{message}</div>}
    {showForm && canCreate && <CreateForm mode={mode} lookups={lookups} onSubmit={create}/>} 
    <DataTable mode={mode} rows={rows} capabilities={capabilities} onAction={rowAction}/>
    {!loading && rows.length === 0 && <div className="mt-6 rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted">Belum ada data pada cakupan ini.</div>}
    <footer className="mt-4 flex items-center justify-between text-sm text-muted"><span>{meta.total} data</span><div className="flex items-center gap-2"><button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>{page} / {meta.totalPages}</span><button className="btn-secondary" disabled={page >= meta.totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></footer>
  </div></main>;
}

function statuses(mode: Phase6Mode) {
  if (mode === "transfers") return ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SOURCE_CLUB_APPROVED", "DESTINATION_CLUB_APPROVED", "COMPETITION_APPROVED", "COMPLETED", "REJECTED", "CANCELLED"];
  if (mode === "transfer-windows") return ["OPEN", "CLOSED"];
  if (mode === "availability") return ["AVAILABLE", "INJURED", "RECOVERING", "SUSPENDED", "UNAVAILABLE"];
  if (mode === "injuries") return ["OPEN", "RECOVERING", "CLEARED", "CLOSED"];
  if (mode === "discipline") return ["OPEN", "DECIDED", "APPEALED", "CLOSED"];
  return ["ACTIVE", "SERVED", "CANCELLED"];
}

function CreateForm({ mode, lookups, onSubmit }: { mode: Phase6Mode; lookups: Lookups; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <form onSubmit={onSubmit} className="mt-5 rounded-2xl border bg-card p-5"><h2 className="font-bold text-white">Data baru</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {(mode === "transfers" || mode === "transfer-windows" || mode === "suspensions" || mode === "discipline") && <><OptionField name="competitionId" label="Kompetisi" options={lookups.competitions}/><OptionField name="seasonId" label="Musim" options={lookups.seasons}/></>}
    {(mode === "transfers" || mode === "availability" || mode === "injuries" || mode === "suspensions" || mode === "discipline") && <OptionField name="playerId" label="Pemain" options={lookups.players}/>} 
    {mode === "transfers" && <><OptionField name="sourceClubId" label="Klub sumber" options={lookups.clubs} optional/><OptionField name="destinationClubId" label="Klub tujuan" options={lookups.clubs} optional/><OptionField name="transferWindowId" label="Transfer window" options={lookups.windows} optional/><Field name="type" label="Tipe" kind="select" options={["PERMANENT","LOAN","LOAN_RETURN","FREE_AGENT_SIGNING","REGISTRATION_RELEASE"]}/><Field name="effectiveAt" label="Tanggal efektif" type="datetime-local"/></>}
    {mode === "transfer-windows" && <><Field name="name" label="Nama window"/><Field name="opensAt" label="Dibuka" type="datetime-local"/><Field name="closesAt" label="Ditutup" type="datetime-local"/><Field name="registrationDeadline" label="Deadline registrasi" type="datetime-local" optional/><Field name="status" label="Status" kind="select" options={["OPEN","CLOSED"]}/></>}
    {mode === "availability" && <><Field name="status" label="Status" kind="select" options={["AVAILABLE","INJURED","RECOVERING","SUSPENDED","UNAVAILABLE"]}/><Field name="startsAt" label="Mulai" type="datetime-local"/><Field name="endsAt" label="Berakhir" type="datetime-local" optional/><Field name="reason" label="Alasan"/><Field name="publicNote" label="Catatan publik" optional/><Check name="publicApproved" label="Boleh ditampilkan publik"/></>}
    {mode === "injuries" && <><Field name="injuryDate" label="Tanggal cedera" type="datetime-local"/><Field name="estimatedReturn" label="Estimasi kembali" type="datetime-local" optional/><Field name="diagnosis" label="Diagnosis privat"/><Field name="medicalNotes" label="Catatan medis privat"/><Field name="publicNote" label="Catatan publik" optional/><Check name="publicApproved" label="Boleh ditampilkan publik"/></>}
    {mode === "suspensions" && <><Field name="effectiveAt" label="Mulai berlaku" type="datetime-local"/><Field name="endsAt" label="Berakhir" type="datetime-local" optional/><Field name="matchBans" label="Jumlah match-ban" type="number" optional/><Field name="reason" label="Alasan"/></>}
    {mode === "discipline" && <Field name="summary" label="Ringkasan perkara"/>}
  </div><button className="btn-primary mt-5" type="submit">Simpan data</button></form>;
}

function OptionField({ name, label, options, optional = false }: { name: string; label: string; options: Option[]; optional?: boolean }) { return <label className="text-xs font-semibold text-muted">{label}<select required={!optional} name={name} className="field mt-2"><option value="">{optional ? "Tidak ada" : "Pilih…"}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name || item.fullName}</option>)}</select></label>; }
function Field({ name, label, type = "text", optional = false, kind, options = [] }: { name: string; label: string; type?: string; optional?: boolean; kind?: "select"; options?: string[] }) { return <label className="text-xs font-semibold text-muted">{label}{kind === "select" ? <select required={!optional} name={name} className="field mt-2">{options.map((item) => <option key={item} value={item}>{text(item)}</option>)}</select> : <input required={!optional} name={name} type={type} className="field mt-2"/>}</label>; }
function Check({ name, label }: { name: string; label: string }) { return <label className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-muted"><input type="checkbox" name={name}/>{label}</label>; }

function DataTable({ mode, rows, capabilities, onAction }: { mode: Phase6Mode; rows: Row[]; capabilities: Record<string, boolean>; onAction: (row: Row, action: string) => void }) {
  if (!rows.length) return null;
  const headers = mode === "transfers" ? ["Pemain","Dari","Ke","Tipe","Status","Efektif","Detail"] : mode === "transfer-windows" ? ["Window","Kompetisi","Musim","Dibuka","Ditutup","Status"] : mode === "availability" ? ["Pemain","Status","Alasan","Mulai","Berakhir","Publik"] : mode === "injuries" ? ["Pemain","Status","Tanggal","Estimasi","Diagnosis","Versi","Aksi"] : mode === "discipline" ? ["Pemain","Kasus","Kartu","Status","Keputusan","Banding","Aksi"] : ["Pemain","Kompetisi","Tipe","Alasan","Sisa ban","Status"];
  return <div className="mt-6 overflow-x-auto rounded-2xl border bg-card"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b bg-white/[.03] text-xs uppercase tracking-wider text-muted"><tr>{headers.map((header) => <th key={header} className="px-4 py-4">{header}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={String(row.id)} className="align-top"><Cells mode={mode} row={row} capabilities={capabilities} onAction={onAction}/></tr>)}</tbody></table></div>;
}

function Cells({ mode, row, capabilities, onAction }: { mode: Phase6Mode; row: Row; capabilities: Record<string, boolean>; onAction: (row: Row, action: string) => void }) {
  const player = object(row.player); const competition = object(row.competition); const season = object(row.season);
  if (mode === "transfers") return <><Cell strong>{text(player.displayName || player.fullName)}</Cell><Cell>{text(object(row.sourceClub).name)}</Cell><Cell>{text(object(row.destinationClub).name)}</Cell><Cell>{text(row.type)}</Cell><Cell><Badge value={row.status}/></Cell><Cell>{date(row.effectiveAt)}</Cell><Cell><Link className="text-accent hover:underline" href={`/admin/transfers/${row.id}`}>Buka workflow</Link></Cell></>;
  if (mode === "transfer-windows") return <><Cell strong>{text(row.name)}</Cell><Cell>{text(competition.name)}</Cell><Cell>{text(season.name)}</Cell><Cell>{date(row.opensAt)}</Cell><Cell>{date(row.closesAt)}</Cell><Cell><Badge value={row.status}/></Cell></>;
  if (mode === "availability") return <><Cell strong>{text(player.displayName || player.fullName)}</Cell><Cell><Badge value={row.status}/></Cell><Cell>{text(row.reason)}</Cell><Cell>{date(row.startsAt)}</Cell><Cell>{date(row.endsAt)}</Cell><Cell>{row.publicApproved ? "Disetujui" : "Privat"}</Cell></>;
  if (mode === "injuries") return <><Cell strong>{text(player.displayName || player.fullName)}</Cell><Cell><Badge value={row.status}/></Cell><Cell>{date(row.injuryDate)}</Cell><Cell>{date(row.estimatedReturn)}</Cell><Cell>{text(row.diagnosis)}</Cell><Cell>v{text(row.version)}</Cell><Cell><div className="flex gap-2">{capabilities["injury.manage"] && <button className="text-accent hover:underline" onClick={() => onAction(row, "progress")}>Progres</button>}{capabilities["injury.clearance"] && <button className="text-emerald-300 hover:underline" onClick={() => onAction(row, "clearance")}>Clearance</button>}</div></Cell></>;
  if (mode === "discipline") return <><Cell strong>{text(player.displayName || player.fullName)}</Cell><Cell>{text(row.summary)}</Cell><Cell>{text(row.cardType)}</Cell><Cell><Badge value={row.status}/></Cell><Cell>{Array.isArray(row.decisions) ? row.decisions.length : 0}</Cell><Cell>{Array.isArray(row.appeals) ? row.appeals.length : 0}</Cell><Cell><div className="flex gap-2">{capabilities["discipline.approve"] && <button className="text-accent hover:underline" onClick={() => onAction(row, "decision")}>Putuskan</button>}{capabilities["discipline.appeal"] && <button className="text-amber-300 hover:underline" onClick={() => onAction(row, "appeal")}>Banding</button>}</div></Cell></>;
  return <><Cell strong>{text(player.displayName || player.fullName)}</Cell><Cell>{text(competition.name)}</Cell><Cell>{text(row.type)}</Cell><Cell>{text(row.reason)}</Cell><Cell>{text(row.remainingMatchBans)}</Cell><Cell><Badge value={row.status}/></Cell></>;
}
function Cell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <td className={`px-4 py-4 ${strong ? "font-semibold text-white" : "text-muted"}`}>{children}</td>; }
function Badge({ value }: { value: unknown }) { return <span className="inline-flex rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-bold text-accent">{text(value)}</span>; }
