"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Invitation = { id: string; email: string; status: string; expiresAt: Date; role: { name: string } };
export function InvitationList({ organizationId, invitations }: { organizationId: string; invitations: Invitation[] }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function act(id: string, action: "resend" | "revoke") { const response = await fetch(`/api/organizer/invitations/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, action }) }); const payload = await response.json(); setMessage(response.ok ? (action === "resend" ? `Undangan dikirim ulang.${payload.previewUrl ? ` Preview lokal: ${payload.previewUrl}` : ""}` : "Undangan dicabut.") : payload.error); if (response.ok) router.refresh(); }
  return <div className="mt-8 space-y-3">{message && <p role="status" className="rounded-xl bg-white/5 p-3 text-sm">{message}</p>}{invitations.map((item) => <article key={item.id} className="flex flex-col gap-3 rounded-xl border bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.email}</p><p className="mt-1 text-xs text-muted">{item.role.name} · {item.status} · kedaluwarsa {new Date(item.expiresAt).toLocaleString("id-ID")}</p></div>{item.status === "PENDING" && <div className="flex gap-2"><button className="btn-secondary" onClick={() => act(item.id, "resend")}>Kirim ulang</button><button className="btn-secondary" onClick={() => act(item.id, "revoke")}>Cabut</button></div>}</article>)}</div>;
}
