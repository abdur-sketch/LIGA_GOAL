import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getApiActor } from "@/lib/auth/api";

export const dynamic = "force-dynamic";
export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  try { await getApiActor(); } catch { redirect("/masuk?callbackUrl=/organizer"); }
  return <div className="min-h-screen"><header className="border-b bg-background/90 px-5 py-4"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><Logo /><nav className="flex flex-wrap gap-4 text-sm text-muted"><Link href="/organizer">Ringkasan</Link><Link href="/organizer/discovery">Profil publik</Link><Link href="/organizer/verification">Verifikasi</Link><Link href="/organizer/members">Anggota</Link><Link href="/organizer/invitations">Undangan</Link><Link href="/organizer/billing">Paket & penggunaan</Link><Link href="/organizer/settings">Pengaturan</Link></nav></div></header>{children}</div>;
}
