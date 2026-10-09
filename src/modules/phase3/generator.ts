export type GeneratedFixture = {
  round: number;
  homeClubId: string;
  awayClubId: string;
};
export type RoundRobinResult = {
  fixtures: GeneratedFixture[];
  byes: { round: number; clubId: string }[];
  rounds: number;
};

export function generateRoundRobin(
  clubIds: string[],
  legs: 1 | 2 = 1,
): RoundRobinResult {
  if (clubIds.length < 2) throw new Error("Minimal dua klub diperlukan.");
  if (new Set(clubIds).size !== clubIds.length)
    throw new Error("Daftar klub mengandung duplikasi.");
  const teams: (string | null)[] = [...clubIds];
  if (teams.length % 2) teams.push(null);
  const fixed = teams[0];
  let rotating = teams.slice(1);
  const firstLeg: GeneratedFixture[] = [];
  const byes: { round: number; clubId: string }[] = [];
  for (let round = 1; round < teams.length; round += 1) {
    const lineup = [fixed, ...rotating];
    for (let index = 0; index < lineup.length / 2; index += 1) {
      const left = lineup[index];
      const right = lineup[lineup.length - 1 - index];
      if (!left || !right) {
        const clubId = left || right;
        if (clubId) byes.push({ round, clubId });
        continue;
      }
      const reverse = (round + index) % 2 === 0;
      firstLeg.push({
        round,
        homeClubId: reverse ? right : left,
        awayClubId: reverse ? left : right,
      });
    }
    rotating = [rotating.at(-1) ?? null, ...rotating.slice(0, -1)];
  }
  if (legs === 1) return { fixtures: firstLeg, byes, rounds: teams.length - 1 };
  const offset = teams.length - 1;
  const secondLeg = firstLeg.map((fixture) => ({
    round: fixture.round + offset,
    homeClubId: fixture.awayClubId,
    awayClubId: fixture.homeClubId,
  }));
  return {
    fixtures: [...firstLeg, ...secondLeg],
    byes: [
      ...byes,
      ...byes.map((bye) => ({ round: bye.round + offset, clubId: bye.clubId })),
    ],
    rounds: offset * 2,
  };
}

export function distributeGroups(
  clubIds: string[],
  groupIds: string[],
  seeded = false,
) {
  if (groupIds.length < 1) throw new Error("Minimal satu grup diperlukan.");
  if (new Set(clubIds).size !== clubIds.length)
    throw new Error("Klub tidak boleh muncul dua kali.");
  const clubs = seeded
    ? [...clubIds]
    : [...clubIds].sort(() => Math.random() - 0.5);
  return clubs.map((clubId, index) => ({
    clubId,
    groupId: groupIds[index % groupIds.length],
    seed: index + 1,
  }));
}

export type BracketNode = {
  round: number;
  position: number;
  label: string;
  homeClubId: string | null;
  awayClubId: string | null;
  nextRound: number | null;
  nextPosition: number | null;
  nextSide: "HOME" | "AWAY" | null;
};
export function generateBracket(
  clubIds: string[],
  seeded = false,
): BracketNode[] {
  if (clubIds.length < 2) throw new Error("Minimal dua klub diperlukan.");
  if (new Set(clubIds).size !== clubIds.length)
    throw new Error("Daftar klub mengandung duplikasi.");
  const size = 2 ** Math.ceil(Math.log2(clubIds.length));
  const roundCount = Math.log2(size);
  const ordered = seeded
    ? [...clubIds]
    : [...clubIds].sort(() => Math.random() - 0.5);
  const slots: (string | null)[] = [
    ...ordered,
    ...Array<string | null>(size - ordered.length).fill(null),
  ];
  const nodes: BracketNode[] = [];
  for (let round = 1; round <= roundCount; round += 1) {
    const tieCount = size / 2 ** round;
    const label =
      tieCount === 1
        ? "Final"
        : tieCount === 2
          ? "Semifinal"
          : tieCount === 4
            ? "Quarterfinal"
            : tieCount === 8
              ? "Round of 16"
              : tieCount === 16
                ? "Round of 32"
                : `Round ${round}`;
    for (let position = 1; position <= tieCount; position += 1)
      nodes.push({
        round,
        position,
        label,
        homeClubId: round === 1 ? slots[(position - 1) * 2] : null,
        awayClubId: round === 1 ? slots[(position - 1) * 2 + 1] : null,
        nextRound: round < roundCount ? round + 1 : null,
        nextPosition: round < roundCount ? Math.ceil(position / 2) : null,
        nextSide: round < roundCount ? (position % 2 ? "HOME" : "AWAY") : null,
      });
  }
  return nodes;
}
