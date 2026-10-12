"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InvitationForm({ organizationId, roles }: { organizationId: string; roles: { id: string; name: string }[] }) {
  const router = useRouter(); const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const response = await fetch("/api/organizer/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, email: form.get("email"), roleId: form.get("roleId") }) }); const payload = await response.json(); setMessage(response.ok ? `Undangan dibuat.${payload.previewUrl ? ` Preview lokal: ${payload.previewUrl}` : ""}` : payload.error); if (response.ok) router.refresh(); }
  return <form onSubmit={submit} className="mt-5 flex flex-col gap-3 sm:flex-row"><input className="field" name="email" type="email" required placeholder="staf@example.id" /><select className="field" name="roleId" required>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button className="btn-primary shrink-0">Kirim undangan</button>{message && <p role="status" className="text-xs text-muted sm:self-center">{message}</p>}</form>;
}
