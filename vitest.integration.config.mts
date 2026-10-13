import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["**/*.integration.test.ts"], setupFiles: ["./tests/integration-safety-setup.ts"], fileParallelism: false },
});
