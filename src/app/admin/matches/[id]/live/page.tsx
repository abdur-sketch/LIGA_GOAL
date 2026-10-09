import { MatchCenter } from "@/components/admin/match-center";
export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchCenter mode="live" id={id} />;
}
