import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "./robots";

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks indexing in demo mode", () => {
    vi.stubEnv("DEMO_MODE", "true");

    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("allows indexing outside demo mode", () => {
    vi.stubEnv("DEMO_MODE", "false");

    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
  });
});
