import { getApiActor } from "@/lib/auth/api";
import { DiscoveryModeration } from "@/components/admin/discovery-moderation";
import { discoveryModerationQueue } from "@/modules/phase16/service";

export default async function DiscoveryModerationPage() { const data = await discoveryModerationQueue(await getApiActor()); return <main className="p-5 py-10 sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Platform moderation</p><h1 className="mt-2 font-display text-3xl font-bold">National discovery</h1><p className="mt-3 text-sm text-muted">Akses membutuhkan grant platform discovery.moderate.view/manage yang eksplisit. Semua keputusan dan alasan dicatat di audit log.</p><div className="mt-8"><DiscoveryModeration organizers={data.organizers} competitions={data.competitions} /></div></main>; }
