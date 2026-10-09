import { Bell, ChevronDown, Menu } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { requireSession } from "@/lib/auth/guards";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <div className="flex min-h-screen"><Sidebar /><div className="min-w-0 flex-1"><header className="flex h-18 items-center justify-between border-b bg-background/85 px-5 backdrop-blur lg:px-8"><button className="grid size-10 place-items-center rounded-xl border lg:hidden" aria-label="Buka navigasi"><Menu size={19} /></button><div className="hidden lg:block"><p className="text-xs text-muted">Organisasi aktif</p><button className="mt-0.5 flex items-center gap-2 text-sm font-bold">Pilih organisasi <ChevronDown size={15} /></button></div><div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-xl border text-muted" aria-label="Notifikasi"><Bell size={18} /></button><div className="grid size-10 place-items-center rounded-full bg-primary font-display text-sm font-extrabold text-background">{session.user.name?.slice(0, 2).toUpperCase() ?? "LG"}</div><div className="hidden sm:block"><p className="text-sm font-bold">{session.user.name}</p><p className="max-w-44 truncate text-xs text-muted">{session.user.email}</p></div></div></header>{children}</div></div>;
}
