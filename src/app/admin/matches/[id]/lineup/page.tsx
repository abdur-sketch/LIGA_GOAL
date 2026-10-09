import { MatchCenter } from "@/components/admin/match-center";
export default async function MatchLineupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchCenter mode="lineup" id={id} />;
}
