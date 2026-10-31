import type { CompetitionKind, ParticipantMode, ScoringMethod } from "@prisma/client";

export type CompetitionTemplateDefinition = {
  code: string;
  name: string;
  description: string;
  kind: CompetitionKind;
  participantMode: ParticipantMode;
  scoringMethod: ScoringMethod;
  suggestedCriteria: Array<{ code: string; name: string; weight: number; maxScore?: number }>;
};

export const COMPETITION_TEMPLATES: CompetitionTemplateDefinition[] = [
  { code: "football", name: "Sepak Bola", description: "Modul liga dan turnamen sepak bola yang sudah tersedia.", kind: "FOOTBALL", participantMode: "TEAM", scoringMethod: "POINTS", suggestedCriteria: [] },
  { code: "lct", name: "Lomba Cerdas Tangkas", description: "Regu, babak, skor benar/salah/rebutan, penalti, dan peringkat.", kind: "QUIZ", participantMode: "TEAM", scoringMethod: "POINTS", suggestedCriteria: [{ code: "BENAR", name: "Jawaban benar", weight: 1 }, { code: "REBUTAN", name: "Soal rebutan", weight: 1 }, { code: "PENALTI", name: "Penalti", weight: 1 }] },
  { code: "school", name: "Lomba Sekolah", description: "Lomba akademik individu atau tim antarkelas dan antarsekolah.", kind: "ACADEMIC", participantMode: "BOTH", scoringMethod: "JUDGES", suggestedCriteria: [{ code: "SUBSTANSI", name: "Substansi", weight: 0.4, maxScore: 100 }, { code: "AKURASI", name: "Akurasi", weight: 0.35, maxScore: 100 }, { code: "PRESENTASI", name: "Presentasi", weight: 0.25, maxScore: 100 }] },
  { code: "arts", name: "Lomba Seni", description: "Penampilan atau karya dengan rubrik dan bobot penilaian juri.", kind: "ARTS", participantMode: "BOTH", scoringMethod: "JUDGES", suggestedCriteria: [{ code: "TEKNIK", name: "Teknik", weight: 0.4, maxScore: 100 }, { code: "KREATIVITAS", name: "Kreativitas", weight: 0.35, maxScore: 100 }, { code: "PENYAJIAN", name: "Penyajian", weight: 0.25, maxScore: 100 }] },
  { code: "religious", name: "Lomba Keagamaan", description: "Template rubrik fleksibel untuk lomba individu maupun beregu.", kind: "RELIGIOUS", participantMode: "BOTH", scoringMethod: "JUDGES", suggestedCriteria: [{ code: "KETEPATAN", name: "Ketepatan", weight: 0.4, maxScore: 100 }, { code: "KELANCARAN", name: "Kelancaran", weight: 0.35, maxScore: 100 }, { code: "PENAMPILAN", name: "Penampilan", weight: 0.25, maxScore: 100 }] },
  { code: "festival", name: "Gebyar / Festival", description: "Acara induk dengan banyak cabang lomba dan agenda bersama.", kind: "FESTIVAL", participantMode: "BOTH", scoringMethod: "CUSTOM", suggestedCriteria: [] },
  { code: "esports", name: "E-Sports", description: "Turnamen individu atau tim berbasis grup, best-of, dan bracket.", kind: "ESPORTS", participantMode: "BOTH", scoringMethod: "KNOCKOUT", suggestedCriteria: [] },
  { code: "custom", name: "Lomba Custom", description: "Atur peserta, sesi, kriteria, dan hasil sesuai kebutuhan.", kind: "OTHER", participantMode: "BOTH", scoringMethod: "CUSTOM", suggestedCriteria: [] },
];

export function templateDefinition(code: string) {
  return COMPETITION_TEMPLATES.find((item) => item.code === code);
}

export function genericLabels(kind: CompetitionKind) {
  if (kind === "FOOTBALL") return { participant: "Klub", participants: "Klub peserta", session: "Pertandingan", sessions: "Pertandingan", result: "Klasemen" };
  if (kind === "QUIZ") return { participant: "Regu", participants: "Regu peserta", session: "Babak", sessions: "Babak & sesi", result: "Peringkat" };
  if (kind === "FESTIVAL") return { participant: "Peserta", participants: "Peserta & cabang", session: "Agenda", sessions: "Agenda", result: "Hasil" };
  return { participant: "Peserta", participants: "Peserta", session: "Sesi", sessions: "Jadwal & sesi", result: "Hasil & peringkat" };
}
