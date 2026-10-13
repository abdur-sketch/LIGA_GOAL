import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseSafety, databaseOperations, findDestructiveMigrationStatements, type DatabaseOperation } from "../src/lib/database-safety";

async function appliedMigrations(databaseUrl: string) {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const identity = await client.$queryRaw<Array<{ database: string; user_name: string }>>`SELECT current_database() AS database, current_user AS user_name`;
    let migrations: string[] = [];
    try {
      const rows = await client.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
      migrations = rows.map((row) => row.migration_name);
    } catch (error) {
      // An empty, explicitly allowlisted database legitimately has no Prisma metadata yet.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("_prisma_migrations") || (!message.includes("42P01") && !message.includes("does not exist"))) throw error;
    }
    return { identity: identity[0], migrations };
  } finally {
    await client.$disconnect();
  }
}

async function inspectPendingMigrations(applied: Set<string>) {
  const root = path.join(process.cwd(), "prisma", "migrations");
  const entries = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory() && !applied.has(entry.name));
  const findings: Array<{ migration: string; patterns: string[] }> = [];
  for (const entry of entries) {
    const sql = await readFile(path.join(root, entry.name, "migration.sql"), "utf8");
    const patterns = findDestructiveMigrationStatements(sql);
    if (patterns.length) findings.push({ migration: entry.name, patterns });
  }
  return { pending: entries.map((entry) => entry.name), findings };
}

async function main() {
  const operation = process.argv[2] as DatabaseOperation | undefined;
  if (!operation || !databaseOperations.includes(operation)) throw new Error(`Usage: database-preflight <${databaseOperations.join("|")}>`);
  const databaseUrl = operation === "test" ? process.env.E2E_SETUP_DATABASE_URL ?? process.env.DATABASE_URL : process.env.DATABASE_URL;
  const target = assertDatabaseSafety({
    operation,
    environment: process.env.LIGA_GOAL_ENVIRONMENT,
    databaseUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
    allowedDatabases: process.env.DATABASE_NAME_ALLOWLIST,
    allowedHosts: process.env.DATABASE_HOST_ALLOWLIST,
    mutationConfirmation: process.env.CONFIRM_DATABASE_MUTATION,
    productionConfirmation: process.env.ALLOW_PRODUCTION_DATABASE_OPERATION,
    changeTicket: process.env.DATABASE_CHANGE_TICKET,
    backupVerifiedAt: process.env.BACKUP_VERIFIED_AT,
  });
  const state = await appliedMigrations(databaseUrl!);
  if (state.identity?.database.toLowerCase() !== target.databaseName) throw new Error("Database aktual tidak cocok dengan nama database pada URL.");

  let pending: string[] = [];
  if (operation === "migrate-dev" || operation === "migrate-deploy") {
    const inspection = await inspectPendingMigrations(new Set(state.migrations));
    pending = inspection.pending;
    if (inspection.findings.length && process.env.DESTRUCTIVE_MIGRATION_REVIEWED !== "YES") {
      throw new Error(`Migration destruktif memerlukan DESTRUCTIVE_MIGRATION_REVIEWED=YES: ${inspection.findings.map((item) => item.migration).join(", ")}`);
    }
  }

  console.log(JSON.stringify({
    status: "PASS",
    operation,
    environment: target.environment,
    database: target.databaseName,
    host: target.host,
    databaseUser: state.identity?.user_name,
    appliedMigrations: state.migrations.length,
    pendingMigrations: pending,
    shadowDatabase: target.shadowDatabaseName,
  }, null, 2));
}

main().catch((error) => {
  console.error(`DATABASE PREFLIGHT FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
