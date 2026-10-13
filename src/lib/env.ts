import { z } from "zod";
import { describeDatabaseUrl } from "./database-safety";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "DATABASE_URL harus PostgreSQL"),
  LIGA_GOAL_ENVIRONMENT: z.enum(["local", "test", "staging", "production"]),
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
  if (environment.NODE_ENV === "production" && (!parsed.data.MALWARE_SCANNER || parsed.data.MALWARE_SCANNER === "signature" || parsed.data.MALWARE_SCANNER === "required")) throw new Error("Production wajib menggunakan malware scanner eksternal.");
  return parsed.data;
}
