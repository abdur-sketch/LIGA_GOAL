import { describe, expect, it } from "vitest";
import { assertDatabaseSafety, findDestructiveMigrationStatements } from "./database-safety";

const base = {
  environment: "test",
  databaseUrl: "postgresql://user:secret@localhost:5432/liga_goal_phase18_test?schema=public",
  allowedDatabases: "liga_goal_phase18_test,liga_goal_phase18_shadow",
  allowedHosts: "localhost",
  mutationConfirmation: "YES",
};

describe("database safety guard", () => {
  it("accepts an explicitly allowlisted isolated test database", () => {
    expect(assertDatabaseSafety({ ...base, operation: "test" }).databaseName).toBe("liga_goal_phase18_test");
  });

  it("fails closed when identity, confirmation, or allowlist does not match", () => {
    expect(() => assertDatabaseSafety({ ...base, operation: "test", environment: undefined })).toThrow(/LIGA_GOAL_ENVIRONMENT/);
    expect(() => assertDatabaseSafety({ ...base, operation: "test", mutationConfirmation: undefined })).toThrow(/CONFIRM_DATABASE_MUTATION/);
    expect(() => assertDatabaseSafety({ ...base, operation: "test", allowedDatabases: "another_test" })).toThrow(/allowlist/);
  });

  it("rejects the main database as its own shadow", () => {
    expect(() => assertDatabaseSafety({ ...base, operation: "migrate-dev", shadowDatabaseUrl: base.databaseUrl })).toThrow(/tidak boleh sama/);
  });

  it("accepts only a distinct allowlisted shadow", () => {
    const result = assertDatabaseSafety({
      ...base,
      operation: "migrate-dev",
      shadowDatabaseUrl: "postgresql://user:secret@localhost:5432/liga_goal_phase18_shadow?schema=public",
    });
    expect(result.shadowDatabaseName).toBe("liga_goal_phase18_shadow");
  });

  it("blocks test operations against production and legacy names", () => {
    expect(() => assertDatabaseSafety({ ...base, operation: "test", databaseUrl: "postgresql://user:secret@localhost:5432/liga_goal_production", allowedDatabases: "liga_goal_production" })).toThrow(/production/);
    expect(() => assertDatabaseSafety({ ...base, operation: "test", databaseUrl: "postgresql://user:secret@localhost:5432/liga_goal_legacy_test", allowedDatabases: "liga_goal_legacy_test" })).toThrow(/legacy/);
  });

  it("detects destructive migration statements for explicit review", () => {
    expect(findDestructiveMigrationStatements('ALTER TABLE "User" DROP COLUMN "name";')).not.toHaveLength(0);
    expect(findDestructiveMigrationStatements('CREATE TABLE "Safe" ("id" TEXT PRIMARY KEY);')).toHaveLength(0);
  });

  it("allows production build reads but keeps production migration fail-closed", () => {
    const production = {
      ...base,
      environment: "production",
      databaseUrl: "postgresql://user:secret@production-db.internal:5432/liga_goal",
      allowedDatabases: "liga_goal",
      allowedHosts: "production-db.internal",
      mutationConfirmation: undefined,
    };
    expect(assertDatabaseSafety({ ...production, operation: "build" }).environment).toBe("production");
    expect(() => assertDatabaseSafety({ ...production, operation: "migrate-deploy", mutationConfirmation: "YES" })).toThrow(/Production migration/);
  });
});
