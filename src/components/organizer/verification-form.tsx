"use client";
import { useState } from "react";

export function VerificationForm({ organizationId }: { organizationId: string }) {
  const [registrationNumber, setRegistrationNumber] = useState(""); const [website, setWebsite] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); const response = await fetch("/api/organizer/verification", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, evidence: { registrationNumber, website } }) }); const result = await response.json(); setMessage(response.ok ? "Permohonan masuk antrean review." : result.error || "Permohonan gagal."); setBusy(false); }
  return <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border bg-surface/60 p-6"><label className="block text-sm">Nomor registrasi<input required maxLength={500} value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} className="mt-2 w-full rounded-xl border bg-background p-3" /></label><label className="block text-sm">Situs/referensi resmi<input type="url" required maxLength={500} value={website} onChange={(event) => setWebsite(event.target.value)} className="mt-2 w-full rounded-xl border bg-background p-3" /></label><button disabled={busy} className="btn-primary">{busy ? "Mengirim…" : "Ajukan verifikasi"}</button>{message && <p role="status" className="text-sm">{message}</p>}</form>;
}
