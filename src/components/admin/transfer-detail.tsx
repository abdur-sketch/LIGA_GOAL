"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useOrganization } from "./organization-context";

type Transfer = Record<string, unknown> & { id: string; status: string; version: number; approvals: Array<Record<string, unknown>>; history: Array<Record<string, unknown>> };
const object = (value: unknown) => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => String(value ?? "—").replaceAll("_", " ");

async function api(url: string, options?: RequestInit) { const response = await fetch(url, options); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Permintaan gagal."); return body; }

export function TransferDetail({ id }: { id: string }) {
  const { organizationId } = useOrganization();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { if (!organizationId) return; try { const { data } = await api(`/api/admin/phase6/transfers/${id}?organizationId=${organizationId}`); setTransfer(data); } catch (error) { setMessage(error instanceof Error ? error.message : "Transfer gagal dimuat."); } }, [id, organizationId]);
  useEffect(() => { const timer = window.setTimeout(load, 0); return () => window.clearTimeout(timer); }, [load]);

  async function action(name: string, step?: string) {
    if (!transfer) return;
    const needsReason = name === "reject" || name === "cancel";
    const reason = needsReason ? window.prompt("Masukkan alasan resmi (minimal 8 karakter):") || "" : undefined;
    if (needsReason && (!reason || reason.length < 8)) return;
    if ((name === "cancel" || name === "reject") && !window.confirm(`Yakin ingin ${name} transfer ini?`)) return;
    setBusy(true); setMessage("");
    try {
      const { data } = await api(`/api/admin/phase6/transfers/${id}/action?organizationId=${organizationId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: name, step, expectedVersion: transfer.version, reason, overrideWindow: false }) });
      setTransfer(data); setMessage("Workflow berhasil diperbarui.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Aksi gagal."); }
    finally { setBusy(false); }
  }

  if (!transfer) return <main className="p-8 text-sm text-muted">{message || "Memuat workflow transfer…"}</main>;
  const player = object(transfer.player), source = object(transfer.sourceClub), destination = object(transfer.destinationClub);
  const approveStep = transfer.status === "UNDER_REVIEW" ? (source.id ? "SOURCE_CLUB" : destination.id ? "DESTINATION_CLUB" : "COMPETITION") : transfer.status === "SOURCE_CLUB_APPROVED" ? (destination.id ? "DESTINATION_CLUB" : "COMPETITION") : "COMPETITION";
  return <main className="p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl">
    <Link href="/admin/transfers" className="inline-flex items-center gap-2 text-sm text-muted hover:text-white"><ArrowLeft size={16}/> Kembali ke transfer</Link>
    <div className="mt-5 rounded-3xl border bg-card p-6 sm:p-8"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-accent">Transfer workflow</p><h1 className="mt-2 text-3xl font-bold text-white">{text(player.displayName || player.fullName)}</h1><p className="mt-2 text-muted">{text(source.name)} <span className="mx-2 text-accent">→</span> {text(destination.name)}</p></div><span className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-bold text-accent">{text(transfer.status)}</span></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Tipe" value={transfer.type}/><Metric label="Kompetisi" value={object(transfer.competition).name}/><Metric label="Musim" value={object(transfer.season).name}/><Metric label="Tanggal efektif" value={transfer.effectiveAt ? new Date(String(transfer.effectiveAt)).toLocaleString("id-ID") : "Belum ditetapkan"}/></div>
      {message && <div className="mt-5 rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm">{message}</div>}
      <div className="mt-6 flex flex-wrap gap-2">
        {transfer.status === "DRAFT" && <button disabled={busy} className="btn-primary" onClick={() => action("submit")}>Ajukan transfer</button>}
        {transfer.status === "SUBMITTED" && <button disabled={busy} className="btn-primary" onClick={() => action("review")}>Mulai review</button>}
        {["UNDER_REVIEW","SOURCE_CLUB_APPROVED","DESTINATION_CLUB_APPROVED"].includes(transfer.status) && <button disabled={busy} className="btn-primary" onClick={() => action("approve", approveStep)}><CheckCircle2 size={16}/> Approve {text(approveStep)}</button>}
        {transfer.status === "COMPETITION_APPROVED" && <button disabled={busy} className="btn-primary" onClick={() => action("complete")}>Efektifkan transfer</button>}
        {!['COMPLETED','REJECTED','CANCELLED'].includes(transfer.status) && <><button disabled={busy} className="btn-secondary" onClick={() => action("reject")}><XCircle size={16}/> Tolak</button><button disabled={busy} className="btn-secondary" onClick={() => action("cancel")}>Batalkan</button></>}
      </div>
    </div>

    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border bg-card p-5"><h2 className="font-bold text-white">Approval</h2><div className="mt-4 space-y-3">{transfer.approvals.length ? transfer.approvals.map((item) => <div key={String(item.id)} className="flex gap-3 rounded-xl bg-white/[.03] p-3"><CheckCircle2 className="mt-0.5 text-emerald-300" size={18}/><div><p className="text-sm font-semibold text-white">{text(item.step)} · {text(item.status)}</p><p className="mt-1 text-xs text-muted">{text(object(item.actor).name)} · {new Date(String(item.createdAt)).toLocaleString("id-ID")}</p></div></div>) : <p className="text-sm text-muted">Belum ada approval.</p>}</div></section>
      <section className="rounded-2xl border bg-card p-5"><h2 className="font-bold text-white">Timeline immutable</h2><div className="mt-4 space-y-4">{transfer.history.map((item) => <div key={String(item.id)} className="relative flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-accent" size={18}/><div><p className="text-sm font-semibold text-white">{text(item.action)} · {text(item.fromStatus)} → {text(item.toStatus)}</p><p className="mt-1 text-xs text-muted">{new Date(String(item.createdAt)).toLocaleString("id-ID")}</p></div></div>)}</div></section></div>
  </div></main>;
}
function Metric({ label, value }: { label: string; value: unknown }) { return <div className="rounded-xl border bg-white/[.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p><p className="mt-2 text-sm font-semibold text-white">{text(value)}</p></div>; }
