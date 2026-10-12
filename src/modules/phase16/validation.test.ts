import { describe, expect, it } from "vitest";
import { competitionPublicationInputSchema, discoveryQuerySchema, moderationActionSchema, organizerProfileInputSchema } from "./validation";
import { normalizeDiscoverySearch } from "./service";

describe("Phase 16 discovery validation", () => {
  it("normalizes accents, spacing, and case deterministically", () => expect(normalizeDiscoverySearch("  LÍGA   JÁWA  ")).toBe("liga jawa"));
  it("bounds public search input and pagination", () => {
    expect(discoveryQuerySchema.parse({ q: "Liga", page: "2", pageSize: "24" })).toMatchObject({ q: "Liga", page: 2, pageSize: 24 });
    expect(() => discoveryQuerySchema.parse({ q: "x".repeat(81) })).toThrow();
    expect(() => discoveryQuerySchema.parse({ pageSize: 25 })).toThrow();
    expect(() => discoveryQuerySchema.parse({ unknown: "value" })).toThrow();
  });
  it("rejects unsafe profile and moderation payloads", () => {
    expect(() => organizerProfileInputSchema.parse({ organizationId: "org", displayName: "Valid Name", websiteUrl: "javascript:alert(1)" })).toThrow();
    expect(() => competitionPublicationInputSchema.parse({ organizationId: "org", competitionId: "comp", ageCategory: "x".repeat(41) })).toThrow();
    expect(() => moderationActionSchema.parse({ entity: "organizer", id: "id", action: "publish", reason: "short" })).toThrow();
  });
});
