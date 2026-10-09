import { Bell, Menu } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { AdminSidebar } from "@/components/admin/sidebar";
import { OrganizationProvider, OrganizationSelect } from "@/components/admin/organization-context";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <OrganizationProvider><div className="flex min-h-screen"><AdminSidebar /><div className="min-w-0 flex-1"><header className="flex h-18 items-center justify-between border-b bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8"><button className="grid size-10 place-items-center rounded-xl border lg:hidden" aria-label="Buka menu"><Menu size={19} /></button><OrganizationSelect /><div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-xl border text-muted" aria-label="Notifikasi"><Bell size={18} /></button><div className="grid size-10 place-items-center rounded-full bg-primary font-display text-xs font-extrabold text-background">{session.user.name?.slice(0, 2).toUpperCase() || "LG"}</div><div className="hidden md:block"><p className="text-sm font-bold">{session.user.name}</p><p className="text-xs text-muted">{session.user.email}</p></div></div></header>{children}</div></div></OrganizationProvider>;
}
