import { describe, expect, it } from "vitest";
import { BRAND } from "./brand";

describe("application brand", () => {
  it("exposes the approved Portal Lomba identity", () => {
    expect(BRAND).toMatchObject({
      name: "PORTAL LOMBA",
      shortName: "Portal Lomba",
      tagline: "Satu Portal, Semua Kompetisi.",
    });
  });
});
