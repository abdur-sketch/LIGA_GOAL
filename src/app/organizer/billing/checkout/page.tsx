import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/billing/checkout-form";
import { getApiActor } from "@/lib/auth/api";
import { organizerOverview } from "@/modules/phase13/service";
import { listPlanCatalog } from "@/modules/phase14/service";
export default async function CheckoutPage() { const actor = await getApiActor(); const overview = await organizerOverview(actor); if (!overview) redirect("/organizer/onboarding"); const catalog = await listPlanCatalog(); const plans = catalog.filter((plan) => plan.code !== "FREE").map((plan) => ({ code: plan.code, name: plan.versions[0]?.displayName ?? plan.code })); return <main className="mx-auto max-w-3xl p-5 py-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-300">Sandbox billing</p><h1 className="mt-2 font-display text-3xl font-bold">Checkout simulasi</h1><p className="mt-2 text-sm text-muted">Harga selalu dibaca ulang dari katalog server. Status dari browser tidak pernah mengaktifkan subscription.</p><CheckoutForm organizationId={overview.organization.id} plans={plans} competitions={overview.competitions} /></main>; }
