import "server-only";

import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { prisma } from "@/db/prisma";
import {
  DEMO_ACCOUNT_LIFETIME_HOURS,
  DEMO_ACCOUNTS_PER_IP_PER_HOUR,
} from "@/features/demo/constants";

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;

export type CreateDemoAccountResult =
  | { ok: true; email: string; password: string }
  | { ok: false; reason: "rate-limited" };

export const hashClientIp = (ip: string) =>
  createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`)
    .digest("hex");

export async function createDemoAccount(options: {
  ipHash: string;
  now?: Date;
}): Promise<CreateDemoAccountResult> {
  const now = options.now ?? new Date();
  const windowStart = new Date(now.getTime() - HOUR_IN_MILLISECONDS);
  const id = randomUUID();
  const email = `demo-${id}@demo.invalid`;
  const password = randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (transaction) => {
    const recentAccounts = await transaction.user.count({
      where: {
        demoIpHash: options.ipHash,
        createdAt: { gte: windowStart },
      },
    });

    if (recentAccounts >= DEMO_ACCOUNTS_PER_IP_PER_HOUR) {
      return { ok: false, reason: "rate-limited" } as const;
    }

    await transaction.user.create({
      data: {
        id,
        email,
        name: `Player ${randomInt(1000, 10000)}`,
        emailVerified: true,
        role: "DEMO",
        demoIpHash: options.ipHash,
        demoExpiresAt: new Date(
          now.getTime() + DEMO_ACCOUNT_LIFETIME_HOURS * HOUR_IN_MILLISECONDS,
        ),
        createdAt: now,
        accounts: {
          create: {
            id: `${id}-credential`,
            accountId: id,
            providerId: "credential",
            password: passwordHash,
          },
        },
      },
    });

    return { ok: true, email, password } as const;
  });
}
