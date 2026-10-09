"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
    setLoading(false);
    if (result?.error) { setError("Email atau kata sandi tidak valid."); return; }
    router.push(searchParams.get("callbackUrl") || "/dashboard"); router.refresh();
  }

  return <form onSubmit={submit} className="mt-8 space-y-5"><label className="block"><span className="mb-2 block text-sm font-semibold">Email</span><span className="flex items-center gap-3 rounded-xl border bg-white/[.03] px-4 focus-within:border-primary/60"><Mail size={18} className="text-muted" /><input name="email" type="email" autoComplete="email" required className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" placeholder="admin@organisasi.id" /></span></label><label className="block"><span className="mb-2 block text-sm font-semibold">Kata sandi</span><span className="flex items-center gap-3 rounded-xl border bg-white/[.03] px-4 focus-within:border-primary/60"><LockKeyhole size={18} className="text-muted" /><input name="password" type="password" minLength={12} maxLength={128} autoComplete="current-password" required className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" placeholder="Minimum 12 karakter" /></span></label>{error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}<button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-background transition hover:bg-[#65efb3] disabled:opacity-60">{loading && <LoaderCircle size={18} className="animate-spin" />}{loading ? "Memverifikasi…" : "Masuk ke dashboard"}</button></form>;
}
