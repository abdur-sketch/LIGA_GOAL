import type { CompetitionRules } from "./validation";

export type EligibilityReason = { code: string; message: string; outcome: "INELIGIBLE" | "PENDING_REVIEW" };
export type EligibilityInput = {
  status: string; verificationStatus: string; dateOfBirth: Date | null; jerseyNumber: number | null;
  clubApproved: boolean; duplicateActiveRegistration: boolean; activeSquadCount: number; jerseyConflict: boolean;
  approvedDocumentTypes: string[]; now: Date; rules: CompetitionRules; forApproval?: boolean;
  suspension: { available: boolean; suspended?: boolean };
};

function ageAt(dateOfBirth: Date, cutoff: Date) {
  let age = cutoff.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = cutoff.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && cutoff.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1;
  return age;
}

export function evaluateEligibility(input: EligibilityInput) {
  const reasons: EligibilityReason[] = [];
  const acceptable = input.forApproval ? ["SUBMITTED", "UNDER_REVIEW"] : ["APPROVED"];
  if (!acceptable.includes(input.status)) reasons.push({ code: "REGISTRATION_STATUS", message: "Status registrasi belum memenuhi syarat.", outcome: "PENDING_REVIEW" });
  if (input.verificationStatus !== "VERIFIED") reasons.push({ code: "VERIFICATION_PENDING", message: "Verifikasi registrasi belum selesai.", outcome: "PENDING_REVIEW" });
  if (!input.clubApproved) reasons.push({ code: "CLUB_NOT_APPROVED", message: "Klub belum disetujui untuk musim kompetisi ini.", outcome: "INELIGIBLE" });
  if (input.duplicateActiveRegistration) reasons.push({ code: "DUPLICATE_REGISTRATION", message: "Pemain memiliki registrasi aktif yang berkonflik.", outcome: "INELIGIBLE" });
  const cutoff = input.rules.age?.cutoffDate ? new Date(input.rules.age.cutoffDate) : input.now;
  if (input.rules.age && !input.dateOfBirth) reasons.push({ code: "DATE_OF_BIRTH_REQUIRED", message: "Tanggal lahir diperlukan untuk aturan usia.", outcome: "PENDING_REVIEW" });
  if (input.dateOfBirth && input.rules.age) {
    const age = ageAt(input.dateOfBirth, cutoff);
    if (input.rules.age.min != null && age < input.rules.age.min) reasons.push({ code: "AGE_BELOW_MINIMUM", message: `Usia ${age} tahun di bawah batas minimum ${input.rules.age.min}.`, outcome: "INELIGIBLE" });
    if (input.rules.age.max != null && age > input.rules.age.max) reasons.push({ code: "AGE_ABOVE_MAXIMUM", message: `Usia ${age} tahun melebihi batas maksimum ${input.rules.age.max}.`, outcome: "INELIGIBLE" });
  }
  if (input.rules.registrationWindow) {
    const start = new Date(input.rules.registrationWindow.start); const end = new Date(input.rules.registrationWindow.end);
    if (input.now < start || input.now > end) reasons.push({ code: "OUTSIDE_REGISTRATION_WINDOW", message: "Registrasi berada di luar jendela pendaftaran.", outcome: "INELIGIBLE" });
  }
  if (input.rules.squadLimit != null && input.activeSquadCount >= input.rules.squadLimit) reasons.push({ code: "SQUAD_LIMIT", message: "Batas jumlah pemain skuad telah tercapai.", outcome: "INELIGIBLE" });
  if (input.rules.jerseyRequired && input.jerseyNumber == null) reasons.push({ code: "JERSEY_REQUIRED", message: "Nomor punggung wajib diisi.", outcome: "PENDING_REVIEW" });
  if (input.rules.uniqueJersey && input.jerseyConflict) reasons.push({ code: "JERSEY_CONFLICT", message: "Nomor punggung sudah digunakan dalam skuad aktif.", outcome: "INELIGIBLE" });
  for (const type of input.rules.requiredDocuments) if (!input.approvedDocumentTypes.includes(type)) reasons.push({ code: `DOCUMENT_${type}`, message: `Dokumen wajib ${type.replaceAll("_", " ").toLowerCase()} belum disetujui.`, outcome: "PENDING_REVIEW" });
  if (input.suspension.available && input.suspension.suspended) reasons.push({ code: "PLAYER_SUSPENDED", message: "Pemain sedang menjalani skorsing.", outcome: "INELIGIBLE" });
  const result = reasons.some((reason) => reason.outcome === "INELIGIBLE") ? "INELIGIBLE" : reasons.length ? "PENDING_REVIEW" : "ELIGIBLE";
  return { result: result as "ELIGIBLE" | "INELIGIBLE" | "PENDING_REVIEW", reasons, suspensionCheck: input.suspension.available ? "AVAILABLE" : "UNAVAILABLE" };
}

export interface SuspensionGateway { check(playerId: string, seasonId: string): Promise<{ available: boolean; suspended?: boolean }>; }
export const unavailableSuspensionGateway: SuspensionGateway = { async check() { return { available: false }; } };
