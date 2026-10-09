import { MatchCenter } from "@/components/admin/match-center";
export default async function MatchReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchCenter mode="review" id={id} />;
}
