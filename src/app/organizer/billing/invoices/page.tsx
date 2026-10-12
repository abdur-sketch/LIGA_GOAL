import Link from "next/link";
import { redirect } from "next/navigation";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";
import { tenantBilling } from "@/modules/phase15/service";
export default async function InvoicesPage() { const actor = await getApiActor(); const overview = await organizerOverview(actor); if (!overview) redirect("/organizer/onboarding"); const data = await tenantBilling(actor, overview.organization.id); return <main className="mx-auto max-w-5xl p-5 py-10"><h1 className="font-display text-3xl font-bold">Invoice simulasi</h1><p className="mt-2 text-sm text-muted">Riwayat immutable; bukan bukti transaksi uang nyata.</p><div className="mt-8 space-y-3">{data.invoices.map((invoice) => <Link key={invoice.id} href={`/organizer/billing/invoices/${invoice.id}`} className="flex justify-between rounded-xl border p-5"><span><b>{invoice.invoiceNumber}</b><small className="block text-muted">{invoice.status}</small></span><span>IDR minor {invoice.totalMinor}</span></Link>)}{!data.invoices.length && <p className="text-muted">Belum ada invoice.</p>}</div></main>; }
