import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import { createTestUser } from "@/tests/integration/factories";
import { GET } from "./route";

const cronRequest = (authorization?: string) =>
  new Request("http://localhost/api/cron/demo-cleanup", {
    headers: authorization ? { authorization } : {},
  });

describe("demo cleanup cron route", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(cronRequest("Bearer "));

    expect(response.status).toBe(401);
  });

  it("rejects requests with a wrong or missing token", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");

    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest("Bearer wrong"))).status).toBe(401);
  });

  it("deletes expired demo users for an authorized request", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const user = await createTestUser({ role: "DEMO" });
    await prisma.user.update({
      where: { id: user.id },
      data: { demoExpiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const response = await GET(cronRequest("Bearer cron-secret"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ deletedUsers: 1 });
    expect(await prisma.user.count()).toBe(0);
  });
});
