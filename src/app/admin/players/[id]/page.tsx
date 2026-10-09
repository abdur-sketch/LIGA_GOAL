import { Phase2Detail } from "@/components/admin/phase2-detail";
export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Phase2Detail kind="players" id={id}/>; }
