import { TransferDetail } from "@/components/admin/transfer-detail";
export default async function TransferPage({ params }: { params: Promise<{ id: string }> }) { return <TransferDetail id={(await params).id}/>; }
