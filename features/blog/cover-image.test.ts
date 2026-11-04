import { describe, expect, it } from "vitest";

import { isAllowedCoverImageUrl, isBlobUrl } from "@/features/blog/cover-image";
import { demoCovers } from "@/features/demo/covers";

describe("cover image url rules", () => {
  it.each([
    "https://abc123.public.blob.vercel-storage.com/posts/cover-x1.png",
    ...demoCovers.map((cover) => cover.url),
  ])("allows %s", (url) => {
    expect(isAllowedCoverImageUrl(url)).toBe(true);
  });

  it.each([
    "https://example.com/cover.png",
    "http://abc123.public.blob.vercel-storage.com/posts/cover.png",
    "https://public.blob.vercel-storage.com.evil.test/cover.png",
    "https://evilpublic.blob.vercel-storage.com.test/cover.png",
    "/demo/covers/nonexistent.webp",
    "/demo/covers/cover-01-crt-glow.webp",
    "/demo/covers/../secret.png",
    "/demo/covers/nested/cover.png",
    "/uploads/posts/cover.png",
    "javascript:alert(1)",
    "",
  ])("rejects %s", (url) => {
    expect(isAllowedCoverImageUrl(url)).toBe(false);
  });

  it("recognizes only blob urls as deletable", () => {
    expect(
      isBlobUrl("https://abc123.public.blob.vercel-storage.com/posts/a.png"),
    ).toBe(true);
    expect(isBlobUrl("/demo/covers/a.png")).toBe(false);
    expect(isBlobUrl("/uploads/posts/a.png")).toBe(false);
  });
});
