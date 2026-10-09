import Link from "next/link";
import { Construction } from "lucide-react";
import { PublicHeader } from "@/components/public/header";

const allowed = new Set(["kompetisi", "pertandingan", "klasemen", "statistik", "top-scorer", "top-assist", "klub", "transfer", "berita"]);

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = allowed.has(section) ? section.replaceAll("-", " ") : "Halaman";
  return <><PublicHeader /><main className="grid min-h-[75vh] place-items-center px-5 text-center"><div><Construction className="mx-auto text-primary" size={42} /><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-primary">Portal publik</p><h1 className="mt-2 font-display text-4xl font-extrabold capitalize">{title}</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">Struktur halaman telah tersedia. Data operasional akan ditambahkan sesuai fase pengembangan.</p><Link href="/" className="mt-6 inline-flex rounded-xl border px-5 py-3 text-sm font-bold hover:bg-white/5">Kembali ke beranda</Link></div></main></>;
}
