"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function VerifyEmailForm() {
  const token = useSearchParams().get("token"); const sent = useRef(false);
  const [state, setState] = useState(token ? "Memverifikasi tautan…" : "Tautan verifikasi tidak valid.");
  useEffect(() => { if (!token || sent.current) return; sent.current = true; void fetch("/api/auth/verify-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).then(async (response) => { const payload = await response.json(); setState(response.ok ? payload.message : payload.error); }); }, [token]);
  return <div className="mt-8 rounded-2xl border bg-surface/60 p-6"><p role="status" className="text-sm leading-6">{state}</p><Link href="/masuk?callbackUrl=/organizer" className="btn-primary mt-5">Lanjut ke halaman masuk</Link></div>;
}
