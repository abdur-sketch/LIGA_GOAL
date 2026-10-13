export const databaseOperations = ["build", "migrate-dev", "migrate-deploy", "test", "backup", "restore"] as const;
export type DatabaseOperation = (typeof databaseOperations)[number];
export type EnvironmentIdentity = "local" | "test" | "staging" | "production";

type SafetyInput = {
  operation: DatabaseOperation;
  environment: string | undefined;
  databaseUrl: string | undefined;
  shadowDatabaseUrl?: string;
  allowedDatabases: string | undefined;
  allowedHosts: string | undefined;
  mutationConfirmation: string | undefined;
  productionConfirmation?: string;
  changeTicket?: string;
  backupVerifiedAt?: string;
  now?: Date;
};

export type SafeDatabaseTarget = {
  environment: EnvironmentIdentity;
  databaseName: string;
  host: string;
  shadowDatabaseName?: string;
};

function csv(value: string | undefined, name: string) {
  const values = (value ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (!values.length) throw new Error(`${name} wajib berisi allowlist eksplisit.`);
  return new Set(values);
}

export function describeDatabaseUrl(value: string, label = "DATABASE_URL") {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} bukan URL yang valid.`);
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error(`${label} wajib menggunakan PostgreSQL.`);
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "")).toLowerCase();
  if (!url.hostname || !databaseName) throw new Error(`${label} wajib memuat host dan nama database.`);
  return { host: url.hostname.toLowerCase(), databaseName, schema: (url.searchParams.get("schema") ?? "public").toLowerCase() };
}

function sameTarget(left: ReturnType<typeof describeDatabaseUrl>, right: ReturnType<typeof describeDatabaseUrl>) {
  return left.host === right.host && left.databaseName === right.databaseName && left.schema === right.schema;
}

export function assertDatabaseSafety(input: SafetyInput): SafeDatabaseTarget {
  if (!databaseOperations.includes(input.operation)) throw new Error("Operasi database tidak dikenal.");
  if (!input.environment || !["local", "test", "staging", "production"].includes(input.environment)) {
    throw new Error("LIGA_GOAL_ENVIRONMENT wajib salah satu local, test, staging, atau production.");
  }
  if (!input.databaseUrl) throw new Error("DATABASE_URL wajib diisi.");
  if (input.operation !== "build" && input.operation !== "backup" && input.mutationConfirmation !== "YES") throw new Error("CONFIRM_DATABASE_MUTATION=YES wajib untuk operasi yang dapat menulis.");

  const environment = input.environment as EnvironmentIdentity;
  const target = describeDatabaseUrl(input.databaseUrl);
  const databaseAllowlist = csv(input.allowedDatabases, "DATABASE_NAME_ALLOWLIST");
  const hostAllowlist = csv(input.allowedHosts, "DATABASE_HOST_ALLOWLIST");
  if (!databaseAllowlist.has(target.databaseName)) throw new Error(`Database target '${target.databaseName}' tidak ada dalam allowlist.`);
  if (!hostAllowlist.has(target.host)) throw new Error(`Host database '${target.host}' tidak ada dalam allowlist.`);

  const productionLike = /(^|[_-])(prod|production)([_-]|$)/i.test(target.databaseName);
  const legacyLike = /(^|[_-])legacy([_-]|$)/i.test(target.databaseName);
  if (legacyLike) throw new Error("Database legacy tidak boleh menjadi target operasi otomatis.");
  if (environment !== "production" && productionLike) throw new Error("Database production tidak cocok dengan environment non-production.");
  if (environment === "production") {
    if (input.operation === "migrate-dev" || input.operation === "test" || input.operation === "restore") {
      throw new Error(`Operasi ${input.operation} dilarang pada production.`);
    }
    if (input.operation === "migrate-deploy") {
      if (input.productionConfirmation !== "APPROVED" || !input.changeTicket) {
        throw new Error("Production migration memerlukan ALLOW_PRODUCTION_DATABASE_OPERATION=APPROVED dan DATABASE_CHANGE_TICKET.");
      }
      const verifiedAt = input.backupVerifiedAt ? new Date(input.backupVerifiedAt) : null;
      const now = input.now ?? new Date();
      if (!verifiedAt || Number.isNaN(verifiedAt.valueOf()) || now.valueOf() - verifiedAt.valueOf() > 24 * 60 * 60 * 1000 || verifiedAt > now) {
        throw new Error("Production migration memerlukan BACKUP_VERIFIED_AT yang valid dalam 24 jam terakhir.");
      }
    }
  }

  if ((input.operation === "test" || input.operation === "restore") && environment !== "test") {
    throw new Error(`Operasi ${input.operation} wajib memakai LIGA_GOAL_ENVIRONMENT=test.`);
  }
  if (input.operation === "test" && !/(test|phase18|e2e)/i.test(target.databaseName)) {
    throw new Error("Test runner wajib memakai database terisolasi dengan penanda test, phase18, atau e2e.");
  }
  if (input.operation === "migrate-dev" && environment !== "local" && environment !== "test") {
    throw new Error("prisma migrate dev hanya diizinkan pada environment local/test.");
  }

  let shadowDatabaseName: string | undefined;
  if (input.operation === "migrate-dev") {
    if (!input.shadowDatabaseUrl) throw new Error("SHADOW_DATABASE_URL terpisah wajib untuk migrate-dev.");
    const shadow = describeDatabaseUrl(input.shadowDatabaseUrl, "SHADOW_DATABASE_URL");
    if (sameTarget(target, shadow)) throw new Error("SHADOW_DATABASE_URL tidak boleh sama dengan DATABASE_URL.");
    if (!databaseAllowlist.has(shadow.databaseName) || !hostAllowlist.has(shadow.host)) throw new Error("Shadow database tidak ada dalam allowlist target/host.");
    if (!/(shadow|phase18)/i.test(shadow.databaseName)) throw new Error("Nama shadow database wajib memuat penanda shadow atau phase18.");
    shadowDatabaseName = shadow.databaseName;
  }

  return { environment, databaseName: target.databaseName, host: target.host, shadowDatabaseName };
}

export const destructiveMigrationPatterns = [
  /\bDROP\s+(TABLE|COLUMN|SCHEMA|TYPE|DATABASE)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bALTER\s+TABLE\b[\s\S]*\bDROP\b/i,
];

export function findDestructiveMigrationStatements(sql: string) {
  return destructiveMigrationPatterns.filter((pattern) => pattern.test(sql)).map((pattern) => pattern.source);
}
