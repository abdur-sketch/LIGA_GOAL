import { describe, expect, it } from "vitest";
import { articleInput, sanitizePlainText } from "./validation";

describe("Phase 7 public content validation", () => {
  it("rejects executable content and invalid slugs", () => {
    const base = { organizationId: "org-1", title: "Judul", slug: "judul-aman", body: "Isi berita", category: "Berita" };
    expect(articleInput.safeParse(base).success).toBe(true);
    expect(articleInput.safeParse({ ...base, body: "<script>alert(1)</script>" }).success).toBe(false);
    expect(articleInput.safeParse({ ...base, slug: "Judul Tidak Aman" }).success).toBe(false);
  });

  it("removes markup before persistence", () => {
    expect(sanitizePlainText("<b>Gol</b> javascript:alert(1)")).toBe("Gol alert(1)");
  });
});
