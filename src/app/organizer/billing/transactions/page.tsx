import { redirect } from "next/navigation";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";
import { tenantBilling } from "@/modules/phase15/service";
export default async function TransactionsPage() { const actor = await getApiActor(); const overview = await organizerOverview(actor); if (!overview) redirect("/organizer/onboarding"); const data = await tenantBilling(actor, overview.organization.id); return <main className="mx-auto max-w-5xl p-5 py-10"><h1 className="font-display text-3xl font-bold">Transaksi sandbox</h1><div className="mt-8 space-y-3">{data.transactions.map((item) => <article key={item.id} className="flex flex-wrap justify-between rounded-xl border p-5"><span><b>{item.externalTransactionId}</b><small className="block text-muted">{item.status}</small></span><span>IDR minor {item.amountMinor}</span></article>)}{!data.transactions.length && <p className="text-muted">Belum ada transaksi.</p>}</div></main>; }
