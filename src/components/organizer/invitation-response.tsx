"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function InvitationResponse() { const token = useSearchParams().get("token"); const [message, setMessage] = useState(""); async function respond(action: "accept" | "decline") { const response = await fetch("/api/organizer/invitations/respond", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action }) }); const payload = await response.json(); setMessage(response.ok ? (action === "accept" ? "Undangan diterima. Workspace sudah tersedia." : "Undangan ditolak.") : payload.error); } return <div className="mt-8 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => respond("accept")} disabled={!token}>Terima undangan</button><button className="btn-secondary" onClick={() => respond("decline")} disabled={!token}>Tolak</button>{message && <p role="status" className="w-full text-sm">{message}</p>}</div>; }
