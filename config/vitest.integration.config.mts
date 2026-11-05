import { config } from "dotenv";
import path from "node:path";
import { defineConfig } from "vitest/config";

config({ path: ".env.test", quiet: true });

if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve("tests/integration/server-only.ts"),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["**/*.integration.test.ts"],
    maxConcurrency: 1,
    setupFiles: ["./tests/integration/setup.ts"],
  },
});
