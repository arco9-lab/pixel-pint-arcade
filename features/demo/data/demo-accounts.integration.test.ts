import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";

vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn(async () => "hashed-password"),
}));

import {
  createDemoAccount,
  hashClientIp,
} from "@/features/demo/data/demo-accounts";

describe("createDemoAccount", () => {
  it("keeps the per-IP limit under parallel requests", async () => {
    const ipHash = hashClientIp("198.51.100.7");

    const results = await Promise.all(
      Array.from({ length: 8 }, () => createDemoAccount({ ipHash })),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(await prisma.user.count({ where: { demoIpHash: ipHash } })).toBe(3);
  });

  it("does not block parallel requests from other addresses", async () => {
    const [first, second] = ["198.51.100.7", "198.51.100.8"].map(hashClientIp);

    const results = await Promise.all(
      [first, first, first, second, second, second].map((ipHash) =>
        createDemoAccount({ ipHash }),
      ),
    );

    expect(results.every((result) => result.ok)).toBe(true);
  });
});
