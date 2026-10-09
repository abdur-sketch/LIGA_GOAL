import { MatchCenter } from "@/components/admin/match-center";
export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchCenter mode="detail" id={id} />;
}
