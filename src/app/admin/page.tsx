import Link from "next/link";
import { getApiActor } from "@/lib/auth/api";
import { platformOperationsOverview } from "@/modules/phase17/service";

export default async function AdminPage() {
  const data = await platformOperationsOverview(await getApiActor());
  const active = data.organizations.find((item) => item.status === "ACTIVE")?._count ?? 0;
  const suspended = data.organizations.find((item) => item.status === "SUSPENDED")?._count ?? 0;
  return <main className="p-5 py-10 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Platform operations</p><h1 className="mt-2 font-display text-3xl font-bold">National operations center</h1><p className="mt-3 text-sm text-muted">Ringkasan aman tanpa secret, payload pekerjaan, atau PII. Diperbarui {data.generatedAt.toLocaleString("id-ID")}.</p><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Organisasi aktif" value={active}/><Metric label="Organisasi suspend" value={suspended}/><Metric label="Kompetisi" value={data.competitions}/><Metric label="Audit 24 jam" value={data.auditEvents24h}/></section><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Queue href="/admin/verification" label="Verifikasi organizer" value={data.queues.pendingVerification}/><Queue href="/admin/abuse" label="Laporan abuse" value={data.queues.openReports}/><Queue href="/admin/operations" label="Jobs/outbox/statistik" value={data.queues.failedJobs + data.queues.pendingOutbox + data.queues.failedStatistics}/><Queue href="/admin/finance" label="Rekonsiliasi pembayaran" value={data.queues.reconciliation}/><Queue href="/admin/audit" label="Audit trail" value={data.auditEvents24h}/></section></main>;
}
function Metric({ label, value }: { label: string; value: number }) { return <article className="rounded-2xl border bg-surface/60 p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>; }
function Queue({ href, label, value }: { href: string; label: string; value: number }) { return <Link href={href} className="rounded-2xl border bg-surface/60 p-5 transition hover:border-primary"><p className="font-bold">{label}</p><p className="mt-2 text-2xl font-bold text-primary">{value}</p></Link>; }
