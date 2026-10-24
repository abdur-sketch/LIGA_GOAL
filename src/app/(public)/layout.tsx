import Link from "next/link";
import { PublicHeader } from "@/components/public/header";
import { BRAND } from "@/lib/brand";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><PublicHeader /><main>{children}</main><footer className="border-t bg-navy/50"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 text-sm text-muted sm:grid-cols-2 lg:px-8"><div><p className="font-display text-lg font-extrabold text-white">PORTAL <span className="text-primary">LOMBA</span></p><p className="mt-2">{BRAND.tagline}</p></div><div className="sm:text-right"><p>Data publik bersumber dari hasil dan snapshot resmi.</p><p className="mt-2"><Link className="underline hover:text-white" href="/privasi">Privasi dan publikasi data</Link></p><p className="mt-2">© 2026 {BRAND.name}</p></div></div></footer></>;
}
