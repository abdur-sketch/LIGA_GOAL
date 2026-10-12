import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PrismaClient, type AdministrativeAreaType } from "@prisma/client";

type RegionRow = {
  code: string;
  name: string;
  type: AdministrativeAreaType;
  parentCode?: string | null;
  slug: string;
};
type RegionFile = {
  sourceName: string;
  sourceVersion: string;
  sourceUrl: string;
  effectiveAt: string;
  expectedSha256: string;
  areas: RegionRow[];
};
const db = new PrismaClient();
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath)
    throw new Error(
      "Usage: npm run regions:import -- /absolute/path/verified-regions.json",
    );
  const absolute = resolve(inputPath);
  const raw = await readFile(absolute, "utf8");
  const input = JSON.parse(raw) as RegionFile;
  if (
    !input.sourceName ||
    !input.sourceVersion ||
    !input.sourceUrl ||
    !input.effectiveAt ||
    !Array.isArray(input.areas)
  )
    throw new Error("Region file metadata is incomplete.");
  const canonical = JSON.stringify(input.areas);
  const checksum = digest(canonical);
  if (checksum !== input.expectedSha256)
    throw new Error(
      `Checksum mismatch: expected ${input.expectedSha256}, received ${checksum}`,
    );
  const codes = new Set<string>();
  for (const area of input.areas) {
    if (!/^\d{2}(?:\.\d{2})?$/.test(area.code) || codes.has(area.code))
      throw new Error(`Invalid or duplicate code: ${area.code}`);
    codes.add(area.code);
    if (
      area.type !== "PROVINCE" &&
      (!area.parentCode || !codes.has(area.parentCode))
    )
      throw new Error(`Parent must precede child: ${area.code}`);
  }
  await db.$transaction(
    async (tx) => {
      const datasetId = `region-${digest(input.sourceVersion).slice(0, 20)}`;
      const dataset = await tx.regionDataset.upsert({
        where: { sourceVersion: input.sourceVersion },
        update: {
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl,
          sourceChecksum: checksum,
          effectiveAt: new Date(input.effectiveAt),
        },
        create: {
          id: datasetId,
          sourceName: input.sourceName,
          sourceVersion: input.sourceVersion,
          sourceUrl: input.sourceUrl,
          sourceChecksum: checksum,
          effectiveAt: new Date(input.effectiveAt),
          isActive: false,
        },
      });
      const ids = new Map<string, string>();
      for (const area of input.areas) {
        const existing = await tx.administrativeArea.findUnique({
          where: { code: area.code },
        });
        const parentId = area.parentCode ? ids.get(area.parentCode) : undefined;
        const record = existing
          ? await tx.administrativeArea.update({
              where: { id: existing.id },
              data: {
                name: area.name,
                type: area.type,
                parentId,
                sourceDatasetId: dataset.id,
                isActive: true,
                retiredAt: null,
              },
            })
          : await tx.administrativeArea.create({
              data: {
                code: area.code,
                name: area.name,
                type: area.type,
                parentId,
                slug: area.slug,
                sourceDatasetId: dataset.id,
                isActive: true,
              },
            });
        ids.set(area.code, record.id);
        const snapshot = {
          code: area.code,
          name: area.name,
          type: area.type,
          parentCode: area.parentCode || null,
          slug: record.slug,
        };
        await tx.administrativeAreaRevision.upsert({
          where: {
            areaId_datasetId: { areaId: record.id, datasetId: dataset.id },
          },
          update: { snapshot },
          create: { areaId: record.id, datasetId: dataset.id, snapshot },
        });
      }
      await tx.administrativeArea.updateMany({
        where: { code: { notIn: [...codes] } },
        data: { isActive: false, retiredAt: new Date() },
      });
      await tx.regionDataset.updateMany({
        where: { id: { not: dataset.id }, isActive: true },
        data: { isActive: false },
      });
      await tx.regionDataset.update({
        where: { id: dataset.id },
        data: { isActive: true },
      });
    },
    { isolationLevel: "Serializable", timeout: 120_000 },
  );
  console.log(
    JSON.stringify({
      file: basename(absolute),
      sourceVersion: input.sourceVersion,
      checksum,
      areas: input.areas.length,
    }),
  );
}

main().finally(() => db.$disconnect());
