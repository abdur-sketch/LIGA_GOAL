import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compare, hash } from "bcryptjs";
import { db } from "@/lib/db";
import { enforceMutationRateLimit } from "@/lib/security/rate-limit";
import { confirmPasswordReset, requestPasswordReset, revokeAllSessions } from "./auth";

const email = "phase8-auth-test@example.test";
let userId = "";

describe("Phase 8 authentication hardening", () => {
  beforeAll(async () => {
    await db.user.deleteMany({ where: { email } });
    const user = await db.user.create({
      data: { email, name: "Phase 8 Test", passwordHash: await hash("InitialPassword123", 4) },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { actorId: userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("uses one-time recovery tokens and revokes existing sessions", async () => {
    const oldToken = await requestPasswordReset(email);
    const token = await requestPasswordReset(email);
    expect(oldToken).toBeTruthy();
    expect(token).toBeTruthy();
    await expect(confirmPasswordReset(oldToken!, "ReplacementPassword123")).rejects.toMatchObject({ status: 400 });
    await confirmPasswordReset(token!, "ReplacementPassword123");
    await expect(confirmPasswordReset(token!, "ReplacementPassword123")).rejects.toMatchObject({ status: 400 });
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await compare("ReplacementPassword123", user.passwordHash)).toBe(true);
    expect(user.sessionVersion).toBe(1);
  });

  it("increments session version when all sessions are revoked", async () => {
    await revokeAllSessions(userId);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).sessionVersion).toBe(2);
  });

  it("enforces a shared database-backed bucket atomically", async () => {
    const key = `phase8-test-${crypto.randomUUID()}`;
    const results = await Promise.allSettled(Array.from({ length: 3 }, () => enforceMutationRateLimit(key, 2, 60_000)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
