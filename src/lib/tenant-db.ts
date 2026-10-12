import { Prisma, type PrismaClient } from "@prisma/client";
import { rootDb, runWithDatabaseTransaction } from "./db";

const tenantPattern = /^[a-zA-Z0-9_-]+$/;

async function setContext(
  tx: Prisma.TransactionClient,
  organizationId: string,
  platformAdmin: boolean,
  accessMode:
    "tenant" | "platform" | "public" | "job" | "identity" | "membership",
  userId = "",
) {
  await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${organizationId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.platform_admin', ${platformAdmin ? "true" : "false"}, true)`;
  await tx.$executeRaw`SELECT set_config('app.access_mode', ${accessMode}, true)`;
}

type TransactionOptions = { maxWait?: number; timeout?: number };

export async function withTenantDatabase<T>(
  client: PrismaClient,
  organizationId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: TransactionOptions,
) {
  if (!tenantPattern.test(organizationId))
    throw new Error("Tenant context tidak valid.");
  return client.$transaction(async (tx) => {
    await setContext(tx, organizationId, false, "tenant");
    return runWithDatabaseTransaction(tx, () => callback(tx));
  }, options);
}

/** Opt-in retry for idempotent jobs when PostgreSQL reports a write conflict. */
export async function withTenantDatabaseRetry<T>(
  client: PrismaClient,
  organizationId: string,
  callback: (tx: Prisma.TransactionClient, attempt: number) => Promise<T>,
  retries = 2,
) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await withTenantDatabase(client, organizationId, (tx) =>
        callback(tx, attempt),
      );
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? error.code
          : null;
      if (code !== "P2034" || attempt > retries) throw error;
    }
  }
}

export async function withPlatformDatabase<T>(
  client: PrismaClient,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  accessMode: "platform" | "public" | "job" | "identity" = "platform",
) {
  return client.$transaction(async (tx) => {
    // Identity operations may access global identity tables, but must never
    // inherit the platform-wide tenant bypass used by audited maintenance and
    // public DAL entrypoints.
    await setContext(tx, "", accessMode !== "identity", accessMode);
    return runWithDatabaseTransaction(tx, () => callback(tx));
  });
}

type DatabaseActor = { id: string; isPlatformAdmin: boolean };

/** Tenant IDs remain untrusted until the callback's authorization check runs. */
export function withActorDatabase<T>(
  actor: DatabaseActor,
  organizationId: string,
  callback: () => Promise<T>,
) {
  // Even platform administrators are tenant-scoped when an organization was
  // selected. Cross-tenant/platform scope is reserved for explicit entrypoints
  // that can be separately authorized and audited.
  void actor;
  return withTenantDatabase(rootDb, organizationId, async () => callback());
}

/** Only audited public DAL functions may be called from this scope. */
export function withPublicDatabase<T>(
  callback: () => Promise<T>,
  client = rootDb,
) {
  return withPlatformDatabase(client, async () => callback(), "public");
}

/** Global identity scope; callers must be allow-listed auth DAL functions. */
export function withIdentityDatabase<T>(
  callback: () => Promise<T>,
  client = rootDb,
) {
  return withPlatformDatabase(client, async () => callback(), "identity");
}

/** Discovers only the organizations belonging to the authenticated identity. */
export function withMembershipDatabase<T>(
  userId: string,
  callback: () => Promise<T>,
  client = rootDb,
) {
  if (!tenantPattern.test(userId))
    throw new Error("Identity context tidak valid.");
  return client.$transaction(async (tx) => {
    await setContext(tx, "", false, "membership", userId);
    return runWithDatabaseTransaction(tx, callback);
  });
}

/** Background jobs must pass through a named, reviewable entrypoint. */
export function withJobDatabase<T>(
  organizationId: string | null,
  callback: () => Promise<T>,
  client = rootDb,
) {
  return organizationId
    ? withTenantDatabase(client, organizationId, async () => callback())
    : withPlatformDatabase(client, async () => callback(), "job");
}
