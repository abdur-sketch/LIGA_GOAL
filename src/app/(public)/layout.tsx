import { PublicHeader } from "@/components/public/header";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><PublicHeader /><main>{children}</main><footer className="border-t bg-navy/50"><div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 text-sm text-muted sm:grid-cols-2 lg:px-8"><div><p className="font-display text-lg font-extrabold text-white">LIGA <span className="text-primary">GOAL</span></p><p className="mt-2">Semua Liga, Satu Platform.</p></div><div className="sm:text-right"><p>Data publik bersumber dari hasil dan snapshot resmi.</p><p className="mt-2">© 2026 LIGA GOAL</p></div></div></footer></>;
}
