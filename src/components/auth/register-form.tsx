"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function RegisterForm() {
  const startedAt = useRef(0);
  useEffect(() => { startedAt.current = Date.now(); }, []);
  const [state, setState] = useState<{ loading?: boolean; error?: string; message?: string; previewUrl?: string }>({});
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState({ loading: true });
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), website: form.get("website"), startedAt: startedAt.current }) });
    const payload = await response.json();
    setState(response.ok ? { message: payload.message, previewUrl: payload.previewUrl } : { error: payload.error || "Pendaftaran gagal." });
  }
  return <form onSubmit={submit} className="mt-8 space-y-4"><input className="field" name="name" required minLength={2} maxLength={100} placeholder="Nama lengkap" autoComplete="name" /><input className="field" name="email" required type="email" placeholder="Email" autoComplete="email" /><input className="field" name="password" required type="password" minLength={12} maxLength={128} placeholder="Password kuat (minimal 12 karakter)" autoComplete="new-password" /><input className="hidden" tabIndex={-1} name="website" autoComplete="off" aria-hidden="true" />{state.error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{state.error}</p>}{state.message && <div role="status" className="rounded-xl bg-primary/10 p-4 text-sm text-primary"><p>{state.message}</p>{state.previewUrl && <Link className="mt-2 inline-block font-bold underline" href={state.previewUrl}>Buka email sandbox lokal</Link>}</div>}<button className="btn-primary w-full" disabled={state.loading}>{state.loading ? "Memproses…" : "Buat akun organizer"}</button><p className="text-center text-sm text-muted">Sudah punya akun? <Link className="font-semibold text-primary" href="/masuk">Masuk</Link></p></form>;
}
