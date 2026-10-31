import { describe, expect, it } from "vitest";
import { genericCompetitionSchema, participantSchema, sessionSchema } from "./validation";

describe("Phase 19 multi-competition validation", () => {
  it("menerima template LCT dan acara induk yang eksplisit", () => {
    const result = genericCompetitionSchema.parse({ organizationId: "org-1", templateCode: "lct", name: "LCT Kabupaten 2026", slug: "lct-kabupaten-2026", parentCompetitionId: "festival-1", startsAt: "2026-11-01", endsAt: "2026-11-02", idempotencyKey: "competition:12345678" });
    expect(result.templateCode).toBe("lct");
    expect(result.parentCompetitionId).toBe("festival-1");
  });

  it("menolak slug, rentang waktu, dan tipe peserta yang tidak valid", () => {
    expect(genericCompetitionSchema.safeParse({ organizationId: "org-1", templateCode: "lct", name: "LCT", slug: "LCT Tidak Valid", startsAt: "2026-11-02", endsAt: "2026-11-01", idempotencyKey: "competition:12345678" }).success).toBe(false);
    expect(participantSchema.safeParse({ organizationId: "org-1", type: "CLUB", name: "Peserta", slug: "peserta" }).success).toBe(false);
  });

  it("membatasi jumlah peserta per sesi", () => {
    expect(sessionSchema.safeParse({ organizationId: "org-1", competitionId: "competition-1", name: "Final", sequence: 1, entryIds: Array.from({ length: 129 }, (_, index) => `entry-${index}`) }).success).toBe(false);
  });
});
