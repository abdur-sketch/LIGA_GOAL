import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";

const mode = process.argv[2] || "full";
if (!["quick", "security", "full"].includes(mode)) {
  console.error("Usage: node scripts/ci-local.mjs <quick|security|full>");
  process.exit(2);
}

function loadLocalEnv() {
  let source;
  try { source = readFileSync(".env", "utf8"); } catch { return; }
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function redact(value) {
  return value
    .replace(/(postgres(?:ql)?:\/\/[^:@/\s]+):[^@/\s]+@/gi, "$1:***@")
    .replace(/(PASSWORD\s+')[^']+(')/gi, "$1***$2");
}

function run(command, args, environment = baseEnv) {
  console.log(`\n> ${command} ${args.map((value) => redact(value)).join(" ")}`);
  const result = spawnSync(command, args, { env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} gagal dengan exit code ${result.status ?? "unknown"}`);
}

function npm(script, environment = baseEnv) {
  run("npm", ["run", script], environment);
}

function normalizedPostgresUrl(value, databaseName) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("LOCAL_CI_ADMIN_DATABASE_URL wajib PostgreSQL.");
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("CI lokal hanya boleh memakai PostgreSQL loopback.");
  url.pathname = `/${databaseName}`;
  url.searchParams.delete("schema");
  return url;
}

function createDatabase(adminUrl, databaseName) {
  run("createdb", [`--maintenance-db=${adminUrl.toString()}`, databaseName], process.env);
}

function dropDatabase(adminUrl, databaseName) {
  spawnSync("dropdb", ["--if-exists", "--force", `--maintenance-db=${adminUrl.toString()}`, databaseName], { env: process.env, stdio: "inherit" });
}

function sql(url, statement, environment = process.env) {
  run("psql", [url.toString(), "-v", "ON_ERROR_STOP=1", "-c", statement], environment);
}

function assertIdentifier(value) {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(value)) throw new Error(`Identifier PostgreSQL tidak aman: ${value}`);
  return value;
}

async function waitFor(url, child) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error("S3 emulator berhenti sebelum siap.");
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("S3 emulator tidak siap dalam 5 detik.");
}

loadLocalEnv();

const quickDatabase = "portal_lomba_ci_quick_test";
const quickUrl = `postgresql://${encodeURIComponent(os.userInfo().username)}@127.0.0.1:5432/${quickDatabase}?schema=public`;
let baseEnv = {
  ...process.env,
  DATABASE_URL: quickUrl,
  LIGA_GOAL_ENVIRONMENT: "test",
  DATABASE_NAME_ALLOWLIST: quickDatabase,
  DATABASE_HOST_ALLOWLIST: "127.0.0.1",
  NEXTAUTH_URL: "http://127.0.0.1:3100",
  NEXTAUTH_SECRET: "portal-lomba-local-ci-secret-only-000000000000",
  CONFIRM_DATABASE_MUTATION: "YES",
};

async function quick() {
  npm("env:check");
  run("./node_modules/.bin/prisma", ["validate"]);
  run("npm", ["audit", "--omit=dev", "--audit-level=high"]);
  npm("lint");
  npm("typecheck");
  npm("test");
}

async function databaseSuite(selectedMode) {
  const marker = `${Date.now().toString(36)}_${process.pid}`.toLowerCase();
  const databaseName = assertIdentifier(`portal_lomba_ci_test_${marker}`);
  const runtimeRole = assertIdentifier(`portal_lomba_ci_runtime_${marker}`);
  const runtimePassword = randomBytes(24).toString("hex");
  const configuredAdmin = process.env.LOCAL_CI_ADMIN_DATABASE_URL || process.env.DATABASE_URL || `postgresql://${encodeURIComponent(os.userInfo().username)}@localhost:5432/postgres`;
  const adminUrl = normalizedPostgresUrl(configuredAdmin, "postgres");
  const ownerUrl = normalizedPostgresUrl(configuredAdmin, databaseName);
  ownerUrl.searchParams.set("schema", "public");
  const runtimeUrl = new URL(ownerUrl);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = runtimePassword;
  const s3Port = 4600 + (process.pid % 1000);
  const s3 = spawn(process.execPath, ["scripts/s3-emulator.mjs"], {
    env: { ...process.env, CI_S3_HOST: "127.0.0.1", CI_S3_PORT: String(s3Port) },
    stdio: ["ignore", "inherit", "inherit"],
  });
  let databaseCreated = false;
  let roleCreated = false;

  try {
    await waitFor(`http://127.0.0.1:${s3Port}/health`, s3);
    createDatabase(adminUrl, databaseName);
    databaseCreated = true;

    baseEnv = {
      ...baseEnv,
      DATABASE_URL: ownerUrl.toString(),
      E2E_SETUP_DATABASE_URL: ownerUrl.toString(),
      RLS_OWNER_DATABASE_URL: ownerUrl.toString(),
      RLS_RUNTIME_DATABASE_URL: runtimeUrl.toString(),
      DATABASE_NAME_ALLOWLIST: databaseName,
      DATABASE_HOST_ALLOWLIST: ownerUrl.hostname,
      DESTRUCTIVE_MIGRATION_REVIEWED: "YES",
      PHASE11_FULL_UAT: "1",
      PHASE11_CONCURRENT_WRITE_TEST: "1",
      PHASE11_RUNTIME_IDENTITY_TEST: "1",
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: `http://127.0.0.1:${s3Port}`,
      S3_BUCKET_PUBLIC: `portal-lomba-public-${marker}`,
      S3_BUCKET_PRIVATE: `portal-lomba-private-${marker}`,
      S3_BUCKET_QUARANTINE: `portal-lomba-quarantine-${marker}`,
      S3_REGION: "us-east-1",
      S3_ACCESS_KEY_ID: "local-ci-access-key",
      S3_SECRET_ACCESS_KEY: "local-ci-secret-key",
      S3_FORCE_PATH_STYLE: "true",
      S3_SERVER_SIDE_ENCRYPTION: "provider",
      MALWARE_SCANNER: "signature",
    };

    npm("env:check");
    npm("db:generate");
    npm("db:deploy");
    run("./node_modules/.bin/prisma", ["migrate", "diff", "--from-url", ownerUrl.toString(), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);

    sql(adminUrl, `CREATE ROLE ${runtimeRole} LOGIN PASSWORD '${runtimePassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;`);
    roleCreated = true;
    sql(normalizedPostgresUrl(configuredAdmin, databaseName), `GRANT CONNECT ON DATABASE ${databaseName} TO ${runtimeRole}; GRANT USAGE ON SCHEMA public TO ${runtimeRole}; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole};`);

    run("npm", ["audit", "--audit-level=moderate"]);
    if (selectedMode === "full") {
      npm("lint");
      npm("typecheck");
    }
    npm("test");
    npm("test:integration");
    if (selectedMode === "full") {
      if (process.env.CI_LOCAL_SKIP_BROWSER_INSTALL !== "1") run("./node_modules/.bin/playwright", ["install", "chromium"]);
      npm("test:e2e");
      npm("build");
    }
  } finally {
    s3.kill("SIGTERM");
    if (databaseCreated) dropDatabase(adminUrl, databaseName);
    if (roleCreated) spawnSync("psql", [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `DROP ROLE IF EXISTS ${runtimeRole};`], { env: process.env, stdio: "inherit" });
  }
}

try {
  if (mode === "quick") await quick();
  else await databaseSuite(mode);
  console.log(`\nPORTAL LOMBA ci:${mode} PASS`);
} catch (error) {
  console.error(`\nPORTAL LOMBA ci:${mode} FAIL`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
