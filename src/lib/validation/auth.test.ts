import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("normalizes a valid email", () => {
    const result = loginSchema.parse({ email: " Admin@PortalLomba.ID ", password: "sangat-rahasia-123" });
    expect(result.email).toBe("admin@portallomba.id");
  });

  it("rejects short passwords", () => {
    expect(loginSchema.safeParse({ email: "admin@portallomba.id", password: "pendek" }).success).toBe(false);
  });

  it("rejects malformed email addresses", () => {
    expect(loginSchema.safeParse({ email: "bukan-email", password: "sangat-rahasia-123" }).success).toBe(false);
  });
});
