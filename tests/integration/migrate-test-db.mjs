import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });

if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("Integration tests must use a test database");
}

process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
