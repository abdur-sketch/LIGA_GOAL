import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], exclude: ["**/*.integration.test.ts", "tests/e2e/**", "node_modules/**"] },
});
