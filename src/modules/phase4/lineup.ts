export type LineupCandidate = {
  playerId: string;
  teamId: string;
  role: "STARTER" | "SUBSTITUTE";
  shirtNumber: number;
  isCaptain: boolean;
  isGoalkeeper: boolean;
  eligible: boolean;
};

export function validateLineup(
  players: LineupCandidate[],
  teamId: string,
  startersRequired: number,
  substitutesLimit: number,
) {
  const errors: string[] = [];
  if (new Set(players.map((player) => player.playerId)).size !== players.length)
    errors.push("Pemain tidak boleh duplikat.");
  if (
    new Set(players.map((player) => player.shirtNumber)).size !== players.length
  )
    errors.push("Nomor punggung tidak boleh duplikat.");
  if (players.some((player) => player.teamId !== teamId))
    errors.push("Pemain berasal dari tim yang berbeda.");
  if (players.some((player) => !player.eligible))
    errors.push("Terdapat pemain yang tidak eligible.");
  if (
    players.filter((player) => player.role === "STARTER").length !==
    startersRequired
  )
    errors.push(`Starting lineup harus berjumlah ${startersRequired} pemain.`);
  if (
    players.filter((player) => player.role === "SUBSTITUTE").length >
    substitutesLimit
  )
    errors.push(`Pemain cadangan maksimal ${substitutesLimit}.`);
  if (players.filter((player) => player.isCaptain).length !== 1)
    errors.push("Lineup harus memiliki tepat satu kapten.");
  if (!players.some((player) => player.isGoalkeeper))
    errors.push("Lineup harus memiliki penjaga gawang.");
  return errors;
}
