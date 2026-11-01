import { ApiError } from "@/lib/auth/api";
import { db } from "@/lib/db";

export async function assertActiveJudgeAssignment(
  judgeId: string,
  organizationId: string,
  sessionId: string,
) {
  const now = new Date();
  const session = await db.competitionSession.findFirst({
    where: { id: sessionId, organizationId },
    select: { id: true, competitionId: true, stageId: true },
  });
  if (!session) throw new ApiError(404, "Sesi penilaian tidak ditemukan.");
  const assignment = await db.judgeAssignment.findFirst({
    where: {
      organizationId,
      competitionId: session.competitionId,
      judgeId,
      status: "ACTIVE",
      conflictDeclared: false,
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      AND: [
        { OR: [{ sessionId: null }, { sessionId: session.id }] },
        { OR: [{ stageId: null }, { stageId: session.stageId ?? "__none__" }] },
      ],
    },
    select: { id: true },
  });
  if (!assignment) throw new ApiError(403, "Juri tidak ditugaskan pada sesi ini atau aksesnya sudah dicabut.");
  return assignment;
}
