import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  createPointAdjustment,
  getStatistics,
  getStatisticsForExport,
  listPointAdjustments,
  recomputeStatistics,
  statisticsLookups,
} from "@/modules/phase5/service";

type Context = { params: Promise<{ resource: string }> };

function scope(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    organizationId: params.get("organizationId") || "",
    competitionId: params.get("competitionId") || "",
    seasonId: params.get("seasonId") || "",
    stageId: params.get("stageId") || undefined,
    groupId: params.get("groupId") || undefined,
  };
}

function failure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError)
    return NextResponse.json({ error: "Data tidak valid.", details: error.flatten().fieldErrors }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    return NextResponse.json({ error: "Permintaan duplikat telah diproses." }, { status: 409 });
  console.error("phase5-api-error", error);
  return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const [{ resource }, actor] = await Promise.all([context.params, getApiActor()]);
    if (resource === "lookups") {
      const organizationId = request.nextUrl.searchParams.get("organizationId") || "";
      return NextResponse.json({ data: await statisticsLookups(actor, organizationId) });
    }
    if (resource === "statistics") return NextResponse.json({ data: await getStatistics(actor, scope(request)) });
    if (resource === "export") {
      const result = await getStatisticsForExport(actor, scope(request));
      if (!result.snapshot) throw new ApiError(404, "Snapshot statistik belum tersedia.");
      const format = request.nextUrl.searchParams.get("format") || "xlsx";
      if (format === "pdf") {
        const pdf = await PDFDocument.create();
        let page = pdf.addPage([842, 595]);
        const font = await pdf.embedFont(StandardFonts.Helvetica);
        const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
        page.drawText(`Klasemen — ${result.snapshot.competition.name} / ${result.snapshot.season.name}`, { x: 42, y: 550, size: 16, font: bold, color: rgb(0.04, 0.1, 0.2) });
        const headers = ["Pos", "Club", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"];
        page.drawText(headers.join("     "), { x: 42, y: 518, size: 9, font: bold });
        let y = 496;
        for (const row of result.snapshot.standings) {
          if (y < 45) { page = pdf.addPage([842, 595]); y = 550; }
          page.drawText([row.position, row.club.name.slice(0, 24), row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points].join("     "), { x: 42, y, size: 9, font });
          y -= 20;
        }
        return new NextResponse(Buffer.from(await pdf.save()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=liga-goal-standings.pdf" } });
      }
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "LIGA GOAL";
      const sheet = workbook.addWorksheet("Standings");
      sheet.columns = [
        { header: "Position", key: "position", width: 10 }, { header: "Club", key: "club", width: 28 },
        { header: "Played", key: "played", width: 10 }, { header: "Won", key: "won", width: 10 },
        { header: "Drawn", key: "drawn", width: 10 }, { header: "Lost", key: "lost", width: 10 },
        { header: "GF", key: "goalsFor", width: 10 }, { header: "GA", key: "goalsAgainst", width: 10 },
        { header: "GD", key: "goalDifference", width: 10 }, { header: "Points", key: "points", width: 10 },
      ];
      result.snapshot.standings.forEach((row) => sheet.addRow({ ...row, club: row.club.name }));
      sheet.getRow(1).font = { bold: true };
      sheet.autoFilter = "A1:J1";
      const players = workbook.addWorksheet("Players");
      players.columns = [
        { header: "Player", key: "player", width: 30 }, { header: "Club", key: "club", width: 25 },
        { header: "Apps", key: "appearances", width: 10 }, { header: "Starts", key: "starts", width: 10 },
        { header: "Goals", key: "goals", width: 10 }, { header: "Assists", key: "assists", width: 10 },
        { header: "Yellow", key: "yellowCards", width: 10 }, { header: "Red", key: "redCards", width: 10 },
      ];
      result.snapshot.playerStatistics.forEach((row) => players.addRow({ ...row, player: row.player.displayName || row.player.fullName, club: row.club.name }));
      players.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(Buffer.from(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=liga-goal-statistics.xlsx" } });
    }
    if (resource === "adjustments") return NextResponse.json({ data: await listPointAdjustments(actor, scope(request)) });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const [{ resource }, actor, body] = await Promise.all([
      context.params,
      getApiActor(),
      request.json(),
    ]);
    enforceMutationRateLimit(`${actor.id}:phase5:${resource}`, 20);
    if (resource === "recompute") return NextResponse.json({ data: await recomputeStatistics(actor, body) });
    if (resource === "adjustments")
      return NextResponse.json({ data: await createPointAdjustment(actor, body) }, { status: 201 });
    throw new ApiError(404, "Endpoint tidak ditemukan.");
  } catch (error) {
    return failure(error);
  }
}
