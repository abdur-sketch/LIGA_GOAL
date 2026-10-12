import { performance } from "node:perf_hooks";
import { PrismaClient, Prisma } from "@prisma/client";

const db = new PrismaClient();
const samples = 100;
const percentile = (values: number[], fraction: number) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];

async function measure(name: string, query: () => Promise<unknown>) {
  for (let index = 0; index < 10; index += 1) await query();
  const values: number[] = [];
  for (let index = 0; index < samples; index += 1) {
    const started = performance.now();
    await query();
    values.push(performance.now() - started);
  }
  values.sort((a, b) => a - b);
  return {
    name,
    samples,
    p50Ms: Number(percentile(values, 0.5).toFixed(3)),
    p95Ms: Number(percentile(values, 0.95).toFixed(3)),
    maxMs: Number(values.at(-1)!.toFixed(3)),
  };
}

async function main() {
  const [{ database }] = await db.$queryRaw<
    Array<{ database: string }>
  >`SELECT current_database() AS database`;
  if (
    process.env.ALLOW_SYNTHETIC_DISCOVERY_BENCHMARK !== "1" ||
    !database.includes("phase16_perf")
  )
    throw new Error(
      "Benchmark hanya boleh dijalankan pada database terisolasi bernama phase16_perf dengan opt-in eksplisit.",
    );
  const province = await db.administrativeArea.findFirstOrThrow({
    where: { code: "31" },
  });
  const city = await db.administrativeArea.findFirstOrThrow({
    where: { code: "31.71" },
  });
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "Organization" (id,name,slug,status,"createdAt","updatedAt")
    SELECT 'perf-org-' || lpad(g::text,5,'0'), 'Organizer Nasional ' || g, 'perf-organizer-' || g, 'ACTIVE'::"OrganizationStatus", now(), now()
    FROM generate_series(1,10000) g ON CONFLICT (id) DO NOTHING
  `);
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "PublicOrganizerProfile" (id,"organizationId","publicSlug","displayName",description,"provinceId","cityId",status,"publishedAt","createdAt","updatedAt")
    SELECT 'perf-profile-' || lpad(g::text,5,'0'), 'perf-org-' || lpad(g::text,5,'0'), 'perf-organizer-' || g, 'Organizer Nasional ' || g, 'Profil benchmark tanpa kontak privat', ${province.id}, ${city.id}, 'PUBLISHED'::"PublicationStatus", now(), now(), now()
    FROM generate_series(1,10000) g ON CONFLICT (id) DO NOTHING
  `);
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "Competition" (id,"organizationId",name,slug,format,status,"startsAt","createdAt","updatedAt")
    SELECT 'perf-comp-' || lpad(g::text,5,'0'), 'perf-org-' || lpad(g::text,5,'0'), 'Liga Jakarta ' || g, 'liga-jakarta-' || g, 'SINGLE_ROUND_ROBIN'::"CompetitionFormat", 'ONGOING'::"CompetitionStatus", now() + (g || ' hours')::interval, now(), now()
    FROM generate_series(1,10000) g ON CONFLICT (id) DO NOTHING
  `);
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "CompetitionPublication" (id,"organizationId","competitionId","publicSlug","provinceId","cityId",status,"searchText","popularityScore","publishedAt","createdAt","updatedAt")
    SELECT 'perf-pub-' || lpad(g::text,5,'0'), 'perf-org-' || lpad(g::text,5,'0'), 'perf-comp-' || lpad(g::text,5,'0'), 'liga-jakarta-' || g, ${province.id}, ${city.id}, 'PUBLISHED'::"PublicationStatus", 'liga jakarta ' || g || ' organizer nasional ' || g, (g % 1000), now() - (g || ' seconds')::interval, now(), now()
    FROM generate_series(1,10000) g ON CONFLICT (id) DO NOTHING
  `);
  await db.$executeRawUnsafe(
    'ANALYZE "Competition", "CompetitionPublication", "PublicOrganizerProfile", "Organization"',
  );
  const base = Prisma.sql`FROM "Competition" c JOIN "CompetitionPublication" cp ON cp."competitionId"=c.id JOIN "Organization" o ON o.id=c."organizationId" JOIN "PublicOrganizerProfile" p ON p."organizationId"=o.id WHERE c."deletedAt" IS NULL AND c.status IN ('REGISTRATION','ONGOING','COMPLETED','ARCHIVED') AND cp.status='PUBLISHED' AND p.status='PUBLISHED' AND o.status='ACTIVE' AND o."deletedAt" IS NULL`;
  const results = await Promise.all([
    measure("trigram_contains", () =>
      db.$queryRaw(
        Prisma.sql`SELECT c.id ${base} AND cp."searchText" LIKE ${"%liga jakarta 42%"} ORDER BY cp."publishedAt" DESC, c.id ASC LIMIT 24`,
      ),
    ),
    measure("region_filter", () =>
      db.$queryRaw(
        Prisma.sql`SELECT c.id ${base} AND cp."provinceId"=${province.id} AND cp."cityId"=${city.id} ORDER BY cp."publishedAt" DESC, c.id ASC LIMIT 24`,
      ),
    ),
    measure("popular_sort", () =>
      db.$queryRaw(
        Prisma.sql`SELECT c.id ${base} ORDER BY cp."popularityScore" DESC, cp."publishedAt" DESC, c.id ASC LIMIT 24`,
      ),
    ),
  ]);
  console.log(
    JSON.stringify(
      {
        database,
        syntheticCompetitions: 10000,
        generatedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
}

main().finally(() => db.$disconnect());
