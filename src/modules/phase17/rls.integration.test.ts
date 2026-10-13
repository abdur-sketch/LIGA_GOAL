import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { withPlatformDatabase, withTenantDatabase } from "@/lib/tenant-db";

const runtimeUrl = process.env.RLS_RUNTIME_DATABASE_URL;
const ownerUrl = process.env.RLS_OWNER_DATABASE_URL;
const runtime = runtimeUrl ? new PrismaClient({ datasources: { db: { url: runtimeUrl } } }) : null;
const owner = ownerUrl ? new PrismaClient({ datasources: { db: { url: ownerUrl } } }) : null;
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizationA = "", organizationB = "", verificationA = "", verificationB = "";

describe.skipIf(!runtime || !owner)("Phase 17 RLS isolation", () => {
  beforeAll(async () => {
    const [a,b] = await Promise.all([
      owner!.organization.create({ data: { name: "Phase17 RLS A", slug: `p17-rls-a-${suffix}`, status: "ACTIVE" } }),
      owner!.organization.create({ data: { name: "Phase17 RLS B", slug: `p17-rls-b-${suffix}`, status: "ACTIVE" } }),
    ]); organizationA=a.id; organizationB=b.id;
    const [va,vb] = await Promise.all([
      owner!.organizerVerification.create({ data: { organizationId: a.id, status: "VERIFIED", evidence: { private: "A" }, submittedAt: new Date() } }),
      owner!.organizerVerification.create({ data: { organizationId: b.id, status: "PENDING_REVIEW", evidence: { private: "B" }, submittedAt: new Date() } }),
    ]); verificationA=va.id; verificationB=vb.id;
  });
  afterAll(async () => { await runtime?.$disconnect(); await owner?.$disconnect(); });

  it("default-denies Phase 17 rows without a database context", async () => {
    expect(await runtime!.organizerVerification.count()).toBe(0);
    expect(await runtime!.abuseReport.count()).toBe(0);
  });
  it("keeps tenant verification and moderation rows isolated", async () => {
    const visibleA = await withTenantDatabase(runtime!, organizationA, (tx) => tx.organizerVerification.findMany({ select: { id: true } }));
    const visibleB = await withTenantDatabase(runtime!, organizationB, (tx) => tx.organizerVerification.findMany({ select: { id: true } }));
    expect(visibleA.map((item) => item.id)).toEqual([verificationA]);
    expect(visibleB.map((item) => item.id)).toEqual([verificationB]);
  });
  it("public scope sees only the verified fact while platform scope sees its queue", async () => {
    const publicRows = await withPlatformDatabase(runtime!, (tx) => tx.organizerVerification.findMany({ select: { id: true, status: true } }), "public");
    expect(publicRows.some((item) => item.id === verificationA && item.status === "VERIFIED")).toBe(true);
    expect(publicRows.some((item) => item.id === verificationB)).toBe(false);
    const platformRows = await withPlatformDatabase(runtime!, (tx) => tx.organizerVerification.findMany({ where: { id: { in: [verificationA, verificationB] } } }));
    expect(platformRows).toHaveLength(2);
  });
});
