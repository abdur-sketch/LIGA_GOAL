import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function ForbiddenPage() { return <main className="grid min-h-screen place-items-center p-6 text-center"><div><ShieldX size={48} className="mx-auto text-gold" /><h1 className="mt-5 font-display text-3xl font-bold">Akses tidak diizinkan</h1><p className="mt-2 text-sm text-muted">Akun Anda tidak memiliki izin untuk membuka halaman ini.</p><Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">Kembali ke dashboard</Link></div></main>; }
