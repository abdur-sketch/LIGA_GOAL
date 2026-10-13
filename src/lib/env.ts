import { z } from "zod";
import { describeDatabaseUrl } from "./database-safety";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "DATABASE_URL harus PostgreSQL"),
  LIGA_GOAL_ENVIRONMENT: z.enum(["local", "test", "staging", "production"]),
  APP_VERSION: z.string().min(1).max(64).optional(),
  APP_COMMIT_SHA: z.string().regex(/^[a-f0-9]{7,64}$/i).optional(),
  DATABASE_NAME_ALLOWLIST: z.string().min(1),
  DATABASE_HOST_ALLOWLIST: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  METRICS_TOKEN: z.string().min(32).optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET_PUBLIC: z.string().min(3).optional(),
  S3_BUCKET_PRIVATE: z.string().min(3).optional(),
  S3_BUCKET_QUARANTINE: z.string().min(3).optional(),
  S3_REGION: z.string().min(2).optional(),
  S3_ACCESS_KEY_ID: z.string().min(3).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(8).optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
  S3_SERVER_SIDE_ENCRYPTION: z.enum(["AES256", "provider"]).default("provider"),
  MALWARE_SCANNER: z.enum(["signature", "clamav", "required"]).optional(),
  CLAMAV_HOST: z.string().min(1).optional(),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  EMAIL_PROVIDER_ENDPOINT: z.string().url().optional(),
  EMAIL_PROVIDER_TOKEN: z.string().min(8).optional(),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_WEBHOOK_TOKEN: z.string().min(8).optional(),
});

export function validateServerEnv(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = serverEnvSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Konfigurasi environment tidak valid: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  if (parsed.data.STORAGE_DRIVER === "s3" && (!parsed.data.S3_ENDPOINT || !parsed.data.S3_BUCKET_PUBLIC || !parsed.data.S3_BUCKET_PRIVATE || !parsed.data.S3_BUCKET_QUARANTINE || !parsed.data.S3_REGION || !parsed.data.S3_ACCESS_KEY_ID || !parsed.data.S3_SECRET_ACCESS_KEY)) {
    throw new Error("Konfigurasi S3 belum lengkap.");
  }
  const target = describeDatabaseUrl(parsed.data.DATABASE_URL);
  const databases = parsed.data.DATABASE_NAME_ALLOWLIST.split(",").map((value) => value.trim().toLowerCase());
  const hosts = parsed.data.DATABASE_HOST_ALLOWLIST.split(",").map((value) => value.trim().toLowerCase());
  if (!databases.includes(target.databaseName) || !hosts.includes(target.host)) throw new Error("DATABASE_URL tidak cocok dengan database/host allowlist environment.");
  if (parsed.data.LIGA_GOAL_ENVIRONMENT !== "production" && /(^|[_-])(prod|production)([_-]|$)/i.test(target.databaseName)) throw new Error("Environment non-production tidak boleh menunjuk database production.");
  if (["staging", "production"].includes(parsed.data.LIGA_GOAL_ENVIRONMENT)) {
    const missing = [
      ["APP_VERSION", parsed.data.APP_VERSION],
      ["APP_COMMIT_SHA", parsed.data.APP_COMMIT_SHA],
      ["METRICS_TOKEN", parsed.data.METRICS_TOKEN],
      ["EMAIL_PROVIDER_ENDPOINT", parsed.data.EMAIL_PROVIDER_ENDPOINT],
      ["EMAIL_PROVIDER_TOKEN", parsed.data.EMAIL_PROVIDER_TOKEN],
      ["ALERT_WEBHOOK_URL", parsed.data.ALERT_WEBHOOK_URL],
      ["ALERT_WEBHOOK_TOKEN", parsed.data.ALERT_WEBHOOK_TOKEN],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Konfigurasi release belum lengkap: ${missing.join(", ")}.`);
    if (parsed.data.STORAGE_DRIVER !== "s3") throw new Error("Staging/production wajib menggunakan object storage S3-compatible.");
    if (parsed.data.MALWARE_SCANNER !== "clamav" || !parsed.data.CLAMAV_HOST || !parsed.data.CLAMAV_PORT) throw new Error("Staging/production wajib menggunakan ClamAV yang dikonfigurasi lengkap.");
    if (!parsed.data.NEXTAUTH_URL.startsWith("https://")) throw new Error("Staging/production wajib menggunakan NEXTAUTH_URL HTTPS.");
  }
  if (environment.NODE_ENV === "production" && (!parsed.data.MALWARE_SCANNER || parsed.data.MALWARE_SCANNER === "signature" || parsed.data.MALWARE_SCANNER === "required")) throw new Error("Production wajib menggunakan malware scanner eksternal.");
  return parsed.data;
}
