import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";
import { seedDatabase } from "./seed-data/seed-database";

const readRequiredEnv = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to run the seed`);
  }

  return value;
};

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? readRequiredEnv("DATABASE_URL");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seedDatabase(prisma, {
      email: readRequiredEnv("ADMIN_EMAIL"),
      name: readRequiredEnv("ADMIN_NAME"),
      password: readRequiredEnv("ADMIN_PASSWORD"),
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
