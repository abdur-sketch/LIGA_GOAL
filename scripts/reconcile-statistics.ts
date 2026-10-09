import { db } from "../src/lib/db";
import {
  getStatistics,
  recomputeStatisticsFromOfficialResult,
} from "../src/modules/phase5/service";

async function main() {
  const fix = process.argv.includes("--fix");
  const scopes = await db.statisticsSnapshot.findMany({
    where: { status: "PUBLISHED" },
    distinct: ["organizationId", "scopeKey"],
    orderBy: { version: "desc" },
    select: {
      organizationId: true,
      competitionId: true,
      seasonId: true,
      stageId: true,
      groupId: true,
      scopeKey: true,
    },
  });
  const actor = await db.user.findFirst({
    where: { isPlatformAdmin: true, isActive: true, deletedAt: null },
    select: { id: true, isActive: true, isPlatformAdmin: true, deletedAt: true },
  });
  if (!actor) throw new Error("Platform admin diperlukan untuk reconciliation.");
  let stale = 0;
  for (const scope of scopes) {
    const result = await getStatistics(actor, {
      ...scope,
      stageId: scope.stageId ?? undefined,
      groupId: scope.groupId ?? undefined,
    });
    if (!result.stale) {
      console.log(`OK    ${scope.scopeKey}`);
      continue;
    }
    stale += 1;
    console.log(`STALE ${scope.scopeKey}`);
    if (fix)
      await recomputeStatisticsFromOfficialResult(actor, {
        ...scope,
        stageId: scope.stageId ?? undefined,
        groupId: scope.groupId ?? undefined,
        idempotencyKey: `reconcile:${scope.scopeKey}:${Date.now()}`,
      });
  }
  console.log(`${scopes.length} scope diperiksa; ${stale} stale${fix ? " dan diperbaiki" : ""}.`);
  if (stale && !fix) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
