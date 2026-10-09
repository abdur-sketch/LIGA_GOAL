export type ScheduleItem = {
  id?: string;
  homeClubId: string;
  awayClubId: string;
  venueId?: string | null;
  refereeId?: string | null;
  kickoffAt?: Date | null;
};
export type ScheduleConflict = {
  code: string;
  message: string;
  itemId?: string;
  severity: "ERROR" | "WARNING";
};
export type ScheduleContext = {
  seasonStart: Date;
  seasonEnd: Date;
  registeredClubIds: Set<string>;
  minimumRestHours: number;
  matchDurationMinutes: number;
  existing?: ScheduleItem[];
};

export function validateSchedule(
  items: ScheduleItem[],
  context: ScheduleContext,
) {
  const conflicts: ScheduleConflict[] = [];
  const all = [...(context.existing || []), ...items];
  for (const item of items) {
    if (item.homeClubId === item.awayClubId)
      conflicts.push({
        code: "SELF_MATCH",
        message: "Klub tidak dapat bertanding melawan dirinya sendiri.",
        itemId: item.id,
        severity: "ERROR",
      });
    if (
      !context.registeredClubIds.has(item.homeClubId) ||
      !context.registeredClubIds.has(item.awayClubId)
    )
      conflicts.push({
        code: "CLUB_NOT_REGISTERED",
        message: "Salah satu klub belum disetujui pada musim ini.",
        itemId: item.id,
        severity: "ERROR",
      });
    if (!item.kickoffAt)
      conflicts.push({
        code: "KICKOFF_REQUIRED",
        message: "Waktu kickoff belum ditentukan.",
        itemId: item.id,
        severity: "ERROR",
      });
    else if (
      item.kickoffAt < context.seasonStart ||
      item.kickoffAt > context.seasonEnd
    )
      conflicts.push({
        code: "OUTSIDE_SEASON",
        message: "Kickoff berada di luar periode musim.",
        itemId: item.id,
        severity: "ERROR",
      });
    if (!item.venueId)
      conflicts.push({
        code: "VENUE_REQUIRED",
        message: "Venue belum ditentukan.",
        itemId: item.id,
        severity: "ERROR",
      });
  }
  for (let leftIndex = 0; leftIndex < all.length; leftIndex += 1)
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < all.length;
      rightIndex += 1
    ) {
      const left = all[leftIndex];
      const right = all[rightIndex];
      if (
        !left.kickoffAt ||
        !right.kickoffAt ||
        (left.id && right.id && left.id === right.id)
      )
        continue;
      const differenceMs = Math.abs(
        left.kickoffAt.getTime() - right.kickoffAt.getTime(),
      );
      const overlapMs = context.matchDurationMinutes * 60_000;
      const shareClub = [left.homeClubId, left.awayClubId].some(
        (club) => club === right.homeClubId || club === right.awayClubId,
      );
      if (shareClub && differenceMs < overlapMs)
        conflicts.push({
          code: "CLUB_CONFLICT",
          message: "Klub dijadwalkan bermain pada waktu yang bertabrakan.",
          itemId: right.id,
          severity: "ERROR",
        });
      if (
        shareClub &&
        differenceMs >= overlapMs &&
        differenceMs < context.minimumRestHours * 3_600_000
      )
        conflicts.push({
          code: "MINIMUM_REST",
          message: `Jeda istirahat klub kurang dari ${context.minimumRestHours} jam.`,
          itemId: right.id,
          severity: "ERROR",
        });
      if (
        left.venueId &&
        left.venueId === right.venueId &&
        differenceMs < overlapMs
      )
        conflicts.push({
          code: "VENUE_CONFLICT",
          message: "Venue digunakan pada waktu yang bertabrakan.",
          itemId: right.id,
          severity: "ERROR",
        });
      if (
        left.refereeId &&
        left.refereeId === right.refereeId &&
        differenceMs < overlapMs
      )
        conflicts.push({
          code: "REFEREE_CONFLICT",
          message: "Wasit ditugaskan pada waktu yang bertabrakan.",
          itemId: right.id,
          severity: "ERROR",
        });
    }
  const unique = new Map(
    conflicts.map((conflict) => [
      `${conflict.code}:${conflict.itemId || "all"}:${conflict.message}`,
      conflict,
    ]),
  );
  return [...unique.values()];
}
