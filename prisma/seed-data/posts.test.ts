import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseArticleContent } from "@/features/blog/data/article-content";
import { demoCovers } from "@/features/demo/covers";
import { seedPosts } from "./posts";
import { SEED_ADMIN_ALIAS, seedReaders } from "./readers";
import type { SeedComment } from "./types";

const coversDirectory = path.join(process.cwd(), "public", "demo", "covers");
const knownAliases = new Set([
  SEED_ADMIN_ALIAS,
  ...seedReaders.map((reader) => reader.alias),
]);

const flattenComments = (comments: SeedComment[]): SeedComment[] =>
  comments.flatMap((comment) => [
    comment,
    ...flattenComments(comment.replies ?? []),
  ]);

describe("seed posts", () => {
  it("has unique slugs and numbers", () => {
    expect(new Set(seedPosts.map((post) => post.slug)).size).toBe(
      seedPosts.length,
    );
    expect(new Set(seedPosts.map((post) => post.number)).size).toBe(
      seedPosts.length,
    );
  });

  it.each(seedPosts.map((post) => [post.slug, post] as const))(
    "%s satisfies the post limits",
    (_slug, post) => {
      expect(post.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(post.title.length).toBeLessThanOrEqual(160);
      expect(post.excerpt.length).toBeLessThanOrEqual(300);
      expect(post.seoTitle?.length ?? 0).toBeLessThanOrEqual(160);
      expect(post.seoDescription?.length ?? 0).toBeLessThanOrEqual(300);
      expect(post.coverImageAlt?.length ?? 0).toBeLessThanOrEqual(180);
      expect(post.tags.length).toBeGreaterThan(0);
      expect(post.content.trim()).not.toBe("");
    },
  );

  it.each(seedPosts.map((post) => [post.slug, post] as const))(
    "%s uses an existing cover with alt text",
    (_slug, post) => {
      if (!post.coverFile) {
        return;
      }

      expect(post.coverFile).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(existsSync(path.join(coversDirectory, post.coverFile))).toBe(true);
      expect(post.coverImageAlt).toBeTruthy();
    },
  );

  it.each(seedPosts.map((post) => [post.slug, post] as const))(
    "%s uses only paragraphs and h2/h3 headings",
    (_slug, post) => {
      const unsupportedHeadings = post.content
        .split(/\r?\n/)
        .filter((line) => /^#/.test(line) && !/^#{2,3}\s+\S/.test(line));

      expect(unsupportedHeadings).toEqual([]);
      expect(parseArticleContent(post.content).blocks.length).toBeGreaterThan(0);
    },
  );

  it("uses unique comment keys and known users", () => {
    const comments = seedPosts.flatMap((post) => flattenComments(post.comments));
    const keys = comments.map((comment) => comment.key);

    expect(new Set(keys).size).toBe(keys.length);
    comments.forEach((comment) => {
      expect(knownAliases.has(comment.author)).toBe(true);
    });
    seedPosts.forEach((post) => {
      post.likes.forEach((alias) => {
        expect(knownAliases.has(alias)).toBe(true);
      });
      expect(new Set(post.likes).size).toBe(post.likes.length);
    });
  });

  it("does not attach comments to posts that disable them", () => {
    seedPosts
      .filter((post) => !post.commentsEnabled || !post.published)
      .forEach((post) => {
        expect(post.comments).toEqual([]);
      });
  });

  it("only sets updatedDaysAgo to a more recent day than daysAgo", () => {
    seedPosts.forEach((post) => {
      if (post.updatedDaysAgo !== null) {
        expect(post.updatedDaysAgo).toBeLessThan(post.daysAgo);
      }
    });
  });
});

describe("demo cover gallery", () => {
  it("lists only existing files with alt text", () => {
    demoCovers.forEach((cover) => {
      expect(cover.url).toMatch(/^\/demo\/covers\/[A-Za-z0-9._-]+$/);
      expect(existsSync(path.join(process.cwd(), "public", cover.url))).toBe(
        true,
      );
      expect(cover.alt.trim()).not.toBe("");
    });
  });
});
