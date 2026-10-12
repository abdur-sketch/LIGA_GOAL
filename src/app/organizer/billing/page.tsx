import Link from "next/link";
import { redirect } from "next/navigation";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";
import { billingSnapshot } from "@/modules/phase14/service";

export default async function BillingPage() {
  const actor = await getApiActor(); const overview = await organizerOverview(actor); if (!overview) redirect("/organizer/onboarding");
  const data = await billingSnapshot(actor, overview.organization.id);
  return <main className="mx-auto max-w-6xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Subscription & billing sandbox</p><h1 className="mt-2 font-display text-3xl font-bold">Paket & penggunaan</h1><section className="mt-8 grid gap-4 md:grid-cols-3"><article className="rounded-2xl border bg-surface/60 p-6"><p className="text-sm text-muted">Paket saat ini</p><p className="mt-2 text-2xl font-bold">{data.plan.displayName}</p><p className="mt-2 text-sm">Versi {data.plan.version} · {data.plan.status}</p></article><article className="rounded-2xl border bg-surface/60 p-6"><p className="text-sm text-muted">Masa berlaku</p><p className="mt-2 font-semibold">{data.plan.validUntil ? data.plan.validUntil.toLocaleString("id-ID") : "Tanpa tanggal akhir"}</p><p className="mt-2 text-xs text-muted">Data tidak dihapus saat paket berakhir.</p></article><article className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-6"><p className="text-sm text-amber-200">Payment gateway</p><p className="mt-2 font-semibold">SIMULASI LOKAL</p><p className="mt-2 text-xs text-muted">Tidak menerima uang nyata atau memakai API provider eksternal.</p></article></section><div className="mt-6 flex flex-wrap gap-3"><Link className="btn-primary" href="/organizer/billing/checkout">Checkout simulasi</Link><Link className="btn-secondary" href="/organizer/billing/invoices">Invoice</Link><Link className="btn-secondary" href="/organizer/billing/transactions">Transaksi</Link><Link className="btn-secondary" href="/organizer/billing/plans">Bandingkan paket</Link><Link className="btn-secondary" href="/organizer/billing/usage">Penggunaan</Link></div></main>;
}
