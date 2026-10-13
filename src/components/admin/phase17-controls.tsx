"use client";
import { useState } from "react";

async function post(operation: string, data: unknown) {
  const response = await fetch("/api/platform/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation, data }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || "Operasi gagal."); return result;
}
export function VerificationControls({ id, version }: { id: string; version: number }) {
  const [busy, setBusy] = useState(false);
  async function act(action: "verify" | "reject" | "suspend") { const reason = window.prompt("Alasan keputusan (minimal 8 karakter):"); if (!reason) return; setBusy(true); try { await post("verification", { id, version, action, reason }); location.reload(); } catch (error) { alert(error instanceof Error ? error.message : "Operasi gagal."); setBusy(false); } }
  return <div className="flex flex-wrap gap-2"><button disabled={busy} className="btn-primary" onClick={() => void act("verify")}>Verifikasi</button><button disabled={busy} className="btn-secondary" onClick={() => void act("reject")}>Tolak</button><button disabled={busy} className="btn-secondary" onClick={() => void act("suspend")}>Suspend badge</button></div>;
}
export function AbuseControls({ reportId, version, hasCompetition }: { reportId: string; version: number; hasCompetition: boolean }) {
  const [busy, setBusy] = useState(false);
  async function act(action: "review" | "dismiss" | "suspend_organizer" | "unpublish_competition") { const reason = window.prompt("Alasan tindakan (minimal 8 karakter):"); if (!reason) return; setBusy(true); try { await post("moderation", { reportId, version, action, reason }); location.reload(); } catch (error) { alert(error instanceof Error ? error.message : "Operasi gagal."); setBusy(false); } }
  return <div className="flex flex-wrap gap-2"><button disabled={busy} className="btn-secondary" onClick={() => void act("review")}>Review</button><button disabled={busy} className="btn-secondary" onClick={() => void act("dismiss")}>Tutup</button><button disabled={busy} className="btn-secondary" onClick={() => void act("suspend_organizer")}>Suspend organizer</button>{hasCompetition && <button disabled={busy} className="btn-secondary" onClick={() => void act("unpublish_competition")}>Unpublish</button>}</div>;
}
export function OrganizationStateControls({ organizationId, suspended }: { organizationId: string; suspended: boolean }) {
  const [busy, setBusy] = useState(false);
  async function act() { const reason = window.prompt("Alasan perubahan status (minimal 8 karakter):"); if (!reason) return; setBusy(true); try { await post("organization", { organizationId, action: suspended ? "reactivate" : "suspend", reason }); location.reload(); } catch (error) { alert(error instanceof Error ? error.message : "Operasi gagal."); setBusy(false); } }
  return <button disabled={busy} className="btn-secondary" onClick={() => void act()}>{suspended ? "Reaktivasi" : "Suspend"}</button>;
}
export function AppealControls({ appealId }: { appealId: string }) {
  const [busy, setBusy] = useState(false);
  async function act(action: "uphold" | "overturn") { const reason = window.prompt("Alasan review appeal (minimal 8 karakter):"); if (!reason) return; setBusy(true); try { await post("appeal", { appealId, action, reason }); location.reload(); } catch (error) { alert(error instanceof Error ? error.message : "Operasi gagal."); setBusy(false); } }
  return <div className="flex gap-2"><button disabled={busy} className="btn-secondary" onClick={() => void act("uphold")}>Pertahankan</button><button disabled={busy} className="btn-primary" onClick={() => void act("overturn")}>Kabulkan</button></div>;
}
