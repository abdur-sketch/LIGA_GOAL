export type ScoreLine = { entryId: string; score: number; penalty: number; weight?: number };

export function calculateRanking(lines: ScoreLine[]) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const weighted = line.score * (line.weight ?? 1) - line.penalty;
    totals.set(line.entryId, (totals.get(line.entryId) ?? 0) + weighted);
  }
  const sorted = [...totals].map(([entryId, totalScore]) => ({ entryId, totalScore })).sort((a, b) => b.totalScore - a.totalScore || a.entryId.localeCompare(b.entryId));
  let previousScore: number | undefined;
  let previousRank = 0;
  return sorted.map((item, index) => {
    const rank = previousScore === item.totalScore ? previousRank : index + 1;
    previousScore = item.totalScore;
    previousRank = rank;
    return { ...item, rank };
  });
}
