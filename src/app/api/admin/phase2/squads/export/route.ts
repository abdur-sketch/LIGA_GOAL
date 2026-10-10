import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, getApiActor } from "@/lib/auth/api";
import { db } from "@/lib/db";
import { listRoster } from "@/modules/phase2/service";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function safeText(value: string) { return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "?"); }

export async function GET(request: NextRequest) {
  try {
    const actor = await getApiActor(); const params = request.nextUrl.searchParams; const organizationId = params.get("organizationId"); if (!organizationId) throw new ApiError(400, "organizationId wajib diisi.");
    await enforceMutationRateLimit(`${actor.id}:${organizationId}:roster-export`, 10, 60_000);
    const format = params.get("format") === "xlsx" ? "xlsx" : "pdf"; const result = await listRoster(actor, { organizationId, search: params.get("search") || "", status: "ACTIVE", seasonId: params.get("seasonId") || undefined, clubId: params.get("clubId") || undefined, page: 1, pageSize: 5000 });
    const rows = result.data; await db.auditLog.create({ data: { organizationId, actorId: actor.id, action: "EXPORT", resourceType: "Roster", after: { format, count: rows.length } } });
    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook(); workbook.creator = "LIGA GOAL"; const sheet = workbook.addWorksheet("Roster");
      sheet.columns = [{ header: "No.", key: "number", width: 8 }, { header: "Pemain", key: "player", width: 28 }, { header: "Klub", key: "club", width: 24 }, { header: "Kompetisi", key: "competition", width: 24 }, { header: "Musim", key: "season", width: 18 }, { header: "Posisi", key: "position", width: 16 }, { header: "Status", key: "status", width: 16 }];
      rows.forEach((entry) => sheet.addRow({ number: entry.jerseyNumber ?? "", player: entry.registration.player.fullName, club: entry.club.name, competition: entry.season.competition.name, season: entry.season.name, position: entry.position || entry.registration.player.primaryPosition || "", status: entry.registration.eligibilityStatus }));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }; sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14324A" } }; sheet.views = [{ state: "frozen", ySplit: 1 }]; sheet.autoFilter = { from: "A1", to: "G1" };
      const bytes = await workbook.xlsx.writeBuffer(); return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=liga-goal-roster.xlsx", "Cache-Control": "private, no-store" } });
    }
    const pdf = await PDFDocument.create(); let page = pdf.addPage([842, 595]); const font = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold); let y = 555;
    const header = () => { page.drawText("LIGA GOAL - Roster Pemain", { x: 40, y, size: 18, font: bold, color: rgb(0.08, 0.2, 0.29) }); y -= 30; page.drawText("No   Pemain                         Klub                    Musim              Status", { x: 40, y, size: 9, font: bold }); y -= 16; };
    header(); for (const entry of rows) { if (y < 40) { page = pdf.addPage([842, 595]); y = 555; header(); } const line = `${String(entry.jerseyNumber ?? "-").padEnd(5)} ${safeText(entry.registration.player.fullName).slice(0, 28).padEnd(30)} ${safeText(entry.club.name).slice(0, 20).padEnd(22)} ${safeText(entry.season.name).slice(0, 16).padEnd(18)} ${entry.registration.eligibilityStatus}`; page.drawText(line, { x: 40, y, size: 9, font }); y -= 15; }
    if (!rows.length) page.drawText("Belum ada pemain dalam roster aktif.", { x: 40, y, size: 10, font }); const bytes = await pdf.save(); return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=liga-goal-roster.pdf", "Cache-Control": "private, no-store" } });
  } catch (error) { if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status }); console.error("roster-export-error", error); return NextResponse.json({ error: "Ekspor roster gagal." }, { status: 500 }); }
}
