import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";

const headersMock = vi.hoisted(() => ({
  forwardedFor: "203.0.113.10" as string | null,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: (name: string) =>
      name === "x-forwarded-for" ? headersMock.forwardedFor : null,
  })),
}));

import { startDemoSessionAction } from "@/features/demo/actions/demo-session";

describe("startDemoSessionAction", () => {
  beforeEach(() => {
    vi.stubEnv("DEMO_MODE", "true");
    headersMock.forwardedFor = "203.0.113.10";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses to create accounts when demo mode is off", async () => {
    vi.stubEnv("DEMO_MODE", "false");

    await expect(startDemoSessionAction()).resolves.toMatchObject({
      ok: false,
      message: "Demo mode is not enabled.",
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("creates a DEMO user with a credential account and expiry", async () => {
    const before = Date.now();
    const result = await startDemoSessionAction();

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: result.email },
      include: { accounts: true },
    });

    expect(user.role).toBe("DEMO");
    expect(user.name).toMatch(/^Player \d{4}$/);
    expect(user.email).toMatch(/^demo-.+@demo\.invalid$/);
    expect(user.demoIpHash).toBeTruthy();
    expect(user.demoIpHash).not.toContain("203.0.113.10");
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({
      providerId: "credential",
      accountId: user.id,
    });
    expect(user.accounts[0].password).not.toBe(result.password);

    const lifetime = user.demoExpiresAt!.getTime() - before;
    expect(lifetime).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(lifetime).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 60 * 1000);
  });

  it("limits accounts to three per hour from one address", async () => {
    for (let index = 0; index < 3; index += 1) {
      await expect(startDemoSessionAction()).resolves.toMatchObject({
        ok: true,
      });
    }

    await expect(startDemoSessionAction()).resolves.toMatchObject({
      ok: false,
      message: expect.stringContaining("Too many demo accounts"),
    });
    expect(await prisma.user.count()).toBe(3);
  });

  it("counts addresses separately", async () => {
    for (let index = 0; index < 3; index += 1) {
      await startDemoSessionAction();
    }

    headersMock.forwardedFor = "198.51.100.7, 203.0.113.10";

    await expect(startDemoSessionAction()).resolves.toMatchObject({
      ok: true,
    });
  });
});
