import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"), "DATABASE_URL harus PostgreSQL"),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  METRICS_TOKEN: z.string().min(32).optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET_PUBLIC: z.string().min(3).optional(),
  S3_BUCKET_PRIVATE: z.string().min(3).optional(),
  S3_REGION: z.string().min(2).optional(),
});

export function validateServerEnv(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = serverEnvSchema.safeParse(environment);
  if (!parsed.success) throw new Error(`Konfigurasi environment tidak valid: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  if (parsed.data.STORAGE_DRIVER === "s3" && (!parsed.data.S3_ENDPOINT || !parsed.data.S3_BUCKET_PUBLIC || !parsed.data.S3_BUCKET_PRIVATE || !parsed.data.S3_REGION)) {
    throw new Error("Konfigurasi S3 belum lengkap.");
  }
  return parsed.data;
}
