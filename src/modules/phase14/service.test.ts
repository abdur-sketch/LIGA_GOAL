import { describe, expect, it } from "vitest";
import { featureKeys, metricKeys } from "./service";

describe("Phase 14 stable registries", () => {
  it("keeps feature keys plan-neutral and unique", () => {
    expect(new Set(featureKeys).size).toBe(featureKeys.length);
    expect(featureKeys).toContain("competition.create");
    expect(featureKeys.some((key) => key.includes("PRO"))).toBe(false);
  });

  it("defines quota metrics independently from RBAC", () => {
    expect(metricKeys).toEqual(expect.arrayContaining(["competition.active", "member.active", "export.monthly"]));
  });
});
