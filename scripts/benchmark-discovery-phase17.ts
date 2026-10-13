import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const sampleCount = 100;
const p = (values: number[], fraction: number) => values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
const optimizedSql = `WITH candidates AS MATERIALIZED (SELECT "competitionId","publishedAt" FROM "CompetitionPublication" WHERE status='PUBLISHED' AND "searchText" LIKE '%liga jakarta 42%') SELECT c.id FROM candidates cp JOIN "Competition" c ON c.id=cp."competitionId" JOIN "Organization" o ON o.id=c."organizationId" JOIN "PublicOrganizerProfile" p ON p."organizationId"=o.id WHERE c."deletedAt" IS NULL AND c.status IN ('REGISTRATION','ONGOING','COMPLETED','ARCHIVED') AND p.status='PUBLISHED' AND o.status='ACTIVE' AND o."deletedAt" IS NULL ORDER BY cp."publishedAt" DESC,c.id LIMIT 24`;
const query = Prisma.raw(optimizedSql);

async function runtimeQuery() {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE liga_goal_runtime");
    await tx.$executeRaw`SELECT set_config('app.access_mode','public',true)`;
    await tx.$executeRaw`SELECT set_config('app.platform_admin','true',true)`;
    return tx.$queryRaw(query);
  });
}
async function measure() {
  const coldStarted = performance.now(); await runtimeQuery(); const firstQueryMs = performance.now() - coldStarted;
  for (let index = 0; index < 10; index += 1) await runtimeQuery();
  const values: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) { const started = performance.now(); await runtimeQuery(); values.push(performance.now() - started); }
  values.sort((a,b) => a-b);
  const concurrentStarted = performance.now(); await Promise.all(Array.from({ length: 20 }, () => runtimeQuery())); const concurrent20Ms = performance.now() - concurrentStarted;
  return { firstQueryMs: +firstQueryMs.toFixed(3), warm: { samples: sampleCount, p50Ms: +p(values,.5).toFixed(3), p95Ms: +p(values,.95).toFixed(3), maxMs: +values.at(-1)!.toFixed(3) }, concurrent20Ms: +concurrent20Ms.toFixed(3), concurrentAverageMs: +(concurrent20Ms/20).toFixed(3) };
}
async function explainUnderRls(sql: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL ROLE liga_goal_runtime");
    await tx.$executeRaw`SELECT set_config('app.access_mode','public',true)`;
    await tx.$executeRaw`SELECT set_config('app.platform_admin','true',true)`;
    return tx.$queryRawUnsafe<Array<{"QUERY PLAN": unknown}>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
  });
}
async function main() {
  const [{ database }] = await db.$queryRaw<Array<{database:string}>>`SELECT current_database() database`;
  if (process.env.ALLOW_PHASE17_BENCHMARK !== "1" || !/^liga_goal_phase17_perf_[a-z0-9_]+$/.test(database)) throw new Error("Benchmark memerlukan opt-in dan database liga_goal_phase17_perf_* terisolasi.");
  const province = await db.administrativeArea.findFirstOrThrow({ where: { code: "31" } }); const city = await db.administrativeArea.findFirstOrThrow({ where: { code: "31.71" } });
  await db.$executeRaw(Prisma.sql`INSERT INTO "Organization" (id,name,slug,status,"createdAt","updatedAt") SELECT 'p17-org-'||lpad(g::text,5,'0'),'Organizer Nasional '||g,'p17-organizer-'||g,'ACTIVE'::"OrganizationStatus",now(),now() FROM generate_series(1,10000) g ON CONFLICT DO NOTHING`);
  await db.$executeRaw(Prisma.sql`INSERT INTO "PublicOrganizerProfile" (id,"organizationId","publicSlug","displayName",status,"publishedAt","createdAt","updatedAt") SELECT 'p17-profile-'||lpad(g::text,5,'0'),'p17-org-'||lpad(g::text,5,'0'),'p17-organizer-'||g,'Organizer Nasional '||g,'PUBLISHED'::"PublicationStatus",now(),now(),now() FROM generate_series(1,10000) g ON CONFLICT DO NOTHING`);
  await db.$executeRaw(Prisma.sql`INSERT INTO "Competition" (id,"organizationId",name,slug,format,status,"createdAt","updatedAt") SELECT 'p17-comp-'||lpad(g::text,5,'0'),'p17-org-'||lpad(g::text,5,'0'),'Liga Jakarta '||g,'p17-liga-'||g,'SINGLE_ROUND_ROBIN'::"CompetitionFormat",'ONGOING'::"CompetitionStatus",now(),now() FROM generate_series(1,10000) g ON CONFLICT DO NOTHING`);
  await db.$executeRaw(Prisma.sql`INSERT INTO "CompetitionPublication" (id,"organizationId","competitionId","publicSlug","provinceId","cityId",status,"searchText","popularityScore","publishedAt","createdAt","updatedAt") SELECT 'p17-pub-'||lpad(g::text,5,'0'),'p17-org-'||lpad(g::text,5,'0'),'p17-comp-'||lpad(g::text,5,'0'),'p17-liga-'||g,${province.id},${city.id},'PUBLISHED'::"PublicationStatus",'liga jakarta '||g||' organizer nasional '||g,g%1000,now()-(g||' seconds')::interval,now(),now() FROM generate_series(1,10000) g ON CONFLICT DO NOTHING`);
  await db.$executeRawUnsafe('ANALYZE "Competition", "CompetitionPublication", "PublicOrganizerProfile", "Organization"');
  const explain = await explainUnderRls(optimizedSql);
  const countExplain = await explainUnderRls(`SELECT count(*) FROM "CompetitionPublication" WHERE status='PUBLISHED' AND "searchText" LIKE '%liga jakarta 42%'`);
  console.log(JSON.stringify({ database, syntheticCompetitions: 10000, rlsRole: "liga_goal_runtime", measuredAt: new Date().toISOString(), latency: await measure(), explain: explain[0]["QUERY PLAN"], countExplain: countExplain[0]["QUERY PLAN"] }, null, 2));
}
main().finally(() => db.$disconnect());
