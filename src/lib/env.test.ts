import { describe, expect, it } from "vitest";
import { validateServerEnv } from "./env";

const localEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://app:secret@localhost:5432/liga_goal_test",
  LIGA_GOAL_ENVIRONMENT: "test",
  DATABASE_NAME_ALLOWLIST: "liga_goal_test",
  DATABASE_HOST_ALLOWLIST: "localhost",
  NEXTAUTH_URL: "http://127.0.0.1:3000",
  NEXTAUTH_SECRET: "a-secure-test-secret-that-is-long-enough",
} satisfies NodeJS.ProcessEnv;

const stagingEnvironment = {
  ...localEnvironment,
  DATABASE_URL: "postgresql://app:secret@staging-db.internal:5432/liga_goal_staging",
  LIGA_GOAL_ENVIRONMENT: "staging",
  DATABASE_NAME_ALLOWLIST: "liga_goal_staging",
  DATABASE_HOST_ALLOWLIST: "staging-db.internal",
  NEXTAUTH_URL: "https://staging.liga-goal.example",
  APP_VERSION: "0.1.0-rc.1",
  APP_COMMIT_SHA: "47a3f5909f7dde6c8e5a119c59aa6fdcd1a105cb",
  METRICS_TOKEN: "metrics-token-that-is-at-least-32-characters",
  STORAGE_DRIVER: "s3",
  S3_ENDPOINT: "https://objects.example.test",
  S3_BUCKET_PUBLIC: "public-bucket",
  S3_BUCKET_PRIVATE: "private-bucket",
  S3_BUCKET_QUARANTINE: "quarantine-bucket",
  S3_REGION: "id-jkt-1",
  S3_ACCESS_KEY_ID: "sandbox-access",
  S3_SECRET_ACCESS_KEY: "sandbox-secret",
  MALWARE_SCANNER: "clamav",
  CLAMAV_HOST: "clamav.internal",
  CLAMAV_PORT: "3310",
  EMAIL_PROVIDER_ENDPOINT: "https://mail.example.test/send",
  EMAIL_PROVIDER_TOKEN: "mail-sandbox-token",
  ALERT_WEBHOOK_URL: "https://alerts.example.test/events",
  ALERT_WEBHOOK_TOKEN: "alert-sandbox-token",
} satisfies NodeJS.ProcessEnv;

describe("server environment validation", () => {
  it("keeps local and test environments provider-optional", () => {
    expect(validateServerEnv(localEnvironment).LIGA_GOAL_ENVIRONMENT).toBe("test");
  });

  it("accepts a complete production-shaped staging configuration", () => {
    expect(validateServerEnv(stagingEnvironment).STORAGE_DRIVER).toBe("s3");
  });

  it("fails closed when release identity and providers are absent in staging", () => {
    expect(() => validateServerEnv({ ...stagingEnvironment, APP_COMMIT_SHA: undefined, ALERT_WEBHOOK_TOKEN: undefined })).toThrow(/APP_COMMIT_SHA, ALERT_WEBHOOK_TOKEN/);
  });

  it("rejects local storage or signature-only scanning in staging", () => {
    expect(() => validateServerEnv({ ...stagingEnvironment, STORAGE_DRIVER: "local" })).toThrow(/object storage/);
    expect(() => validateServerEnv({ ...stagingEnvironment, MALWARE_SCANNER: "signature" })).toThrow(/ClamAV/);
  });
});
