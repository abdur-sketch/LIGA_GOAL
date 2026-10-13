import { assertDatabaseSafety, describeDatabaseUrl } from "@/lib/database-safety";

const urls = [
  process.env.DATABASE_URL,
  process.env.RLS_OWNER_DATABASE_URL,
  process.env.RLS_RUNTIME_DATABASE_URL,
].filter((value): value is string => Boolean(value));

if (!urls.length) throw new Error("Integration test membutuhkan database test terisolasi.");
for (const databaseUrl of urls) {
  assertDatabaseSafety({
    operation: "test",
    environment: process.env.LIGA_GOAL_ENVIRONMENT,
    databaseUrl,
    allowedDatabases: process.env.DATABASE_NAME_ALLOWLIST,
    allowedHosts: process.env.DATABASE_HOST_ALLOWLIST,
    mutationConfirmation: process.env.CONFIRM_DATABASE_MUTATION,
  });
}
const targets = urls.map((value) => describeDatabaseUrl(value));
if (targets.some((target) => target.host !== targets[0].host || target.databaseName !== targets[0].databaseName)) {
  throw new Error("DATABASE_URL, RLS_OWNER_DATABASE_URL, dan RLS_RUNTIME_DATABASE_URL wajib menunjuk database test yang sama.");
}
