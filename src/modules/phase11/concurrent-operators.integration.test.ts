import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rootDb } from "@/lib/db";
import { withTenantDatabase } from "@/lib/tenant-db";
import { createEvent } from "@/modules/phase4/service";

const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const enabled = process.env.PHASE11_CONCURRENT_WRITE_TEST === "1" && ownerUrl;
const owner = ownerUrl
  ? new PrismaClient({ datasources: { db: { url: ownerUrl } } })
  : null;
const matchId = "phase11-load-050";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationId = "";
let actorId = "";

describe.skipIf(!enabled)("Phase 11 concurrent match operators", () => {
  beforeAll(async () => {
    const match = await owner!.match.update({
      where: { id: matchId },
      data: { status: "LIVE_FIRST_HALF", version: 1 },
    });
    organizationId = match.organizationId;
    actorId = (
      await owner!.user.create({
        data: {
          name: "Phase 11 Concurrent Operator",
          email: `phase11-operator-${suffix}@test.invalid`,
          passwordHash: "test",
          isPlatformAdmin: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await rootDb.$disconnect();
    await owner!.auditLog.deleteMany({ where: { actorId } });
    await owner!.matchRealtimeOutbox.deleteMany({ where: { matchId } });
    await owner!.matchEvent.deleteMany({ where: { matchId } });
    await owner!.user.delete({ where: { id: actorId } });
    await owner!.$disconnect();
  });

  it("preserves optimistic concurrency and idempotency under the runtime role", async () => {
    const actor = {
      id: actorId,
      isActive: true,
      isPlatformAdmin: true,
      deletedAt: null,
    };
    const input = (key: string, expectedVersion: number) => ({
      idempotencyKey: key,
      eventType: "KICK_OFF" as const,
      period: "FIRST_HALF" as const,
      minute: 0,
      expectedVersion,
    });
    const keys = [`phase11-write-a-${suffix}`, `phase11-write-b-${suffix}`];
    const first = await Promise.allSettled(
      keys.map((key) =>
        withTenantDatabase(rootDb, organizationId, () =>
          createEvent(actor, organizationId, matchId, input(key, 1)),
        ),
      ),
    );
    expect(
      first.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(first.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    expect(await owner!.matchEvent.count({ where: { matchId } })).toBe(1);

    const failedIndex = first.findIndex(
      (result) => result.status === "rejected",
    );
    const current = await owner!.match.findUniqueOrThrow({
      where: { id: matchId },
      select: { version: true },
    });
    const retry = await withTenantDatabase(rootDb, organizationId, () =>
      createEvent(
        actor,
        organizationId,
        matchId,
        input(keys[failedIndex], current.version),
      ),
    );
    expect(retry.duplicate).toBe(false);
    const replay = await withTenantDatabase(rootDb, organizationId, () =>
      createEvent(actor, organizationId, matchId, input(keys[failedIndex], 1)),
    );
    expect(replay.duplicate).toBe(true);
    expect(replay.event.id).toBe(retry.event.id);
    expect(await owner!.matchEvent.count({ where: { matchId } })).toBe(2);
  });
});
