import { describe, expect, it } from "vitest";

import { prisma } from "@/db/prisma";
import { createTestPost, createTestUser } from "@/tests/integration/factories";
import { seedPosts } from "./posts";
import { seedReaders } from "./readers";
import type { SeedComment } from "./types";
import { seedDatabase } from "./seed-database";

const admin = {
  email: "seed-admin@example.test",
  name: "Seed Admin",
  password: "seed-admin-password",
};

const countComments = (comments: SeedComment[]): number =>
  comments.reduce(
    (total, comment) => total + 1 + countComments(comment.replies ?? []),
    0,
  );

const countRecords = async () => ({
  users: await prisma.user.count(),
  accounts: await prisma.account.count(),
  posts: await prisma.post.count(),
  tags: await prisma.tag.count(),
  comments: await prisma.comment.count(),
  likes: await prisma.postLike.count(),
  bookmarks: await prisma.postBookmark.count(),
});

describe("seedDatabase", () => {
  it("creates the admin with a credential account", async () => {
    await seedDatabase(prisma, admin);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: admin.email },
      include: { accounts: true },
    });

    expect(user.role).toBe("ADMIN");
    expect(user.accounts).toHaveLength(1);
    expect(user.accounts[0]).toMatchObject({
      providerId: "credential",
      accountId: user.id,
    });
    expect(user.accounts[0].password).toBeTruthy();
  });

  it("creates readers that cannot sign in", async () => {
    await seedDatabase(prisma, admin);

    const readers = await prisma.user.findMany({
      where: { id: { in: seedReaders.map((reader) => reader.id) } },
      include: { accounts: true },
    });

    expect(readers).toHaveLength(seedReaders.length);
    readers.forEach((reader) => {
      expect(reader.role).toBe("USER");
      expect(reader.accounts).toHaveLength(0);
    });
  });

  it("creates every seed post", async () => {
    await seedDatabase(prisma, admin);

    const slugs = (await prisma.post.findMany({ select: { slug: true } })).map(
      (post) => post.slug,
    );

    expect(slugs.sort()).toEqual(seedPosts.map((post) => post.slug).sort());
  });

  it("produces the same record counts when run twice", async () => {
    await seedDatabase(prisma, admin);
    const firstRun = await countRecords();

    await seedDatabase(prisma, admin);

    expect(await countRecords()).toEqual(firstRun);
  });

  it("keeps posts added manually by the admin", async () => {
    await seedDatabase(prisma, admin);
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: admin.email },
    });
    await createTestPost({
      authorId: adminUser.id,
      slug: "manual-admin-post",
      title: "Manual admin post",
    });

    await seedDatabase(prisma, admin);

    const manualPost = await prisma.post.findUnique({
      where: { slug: "manual-admin-post" },
    });

    expect(manualPost?.title).toBe("Manual admin post");
  });

  it("does not touch unrelated users", async () => {
    const otherUser = await createTestUser({ role: "DEMO" });

    await seedDatabase(prisma, admin);

    const stillThere = await prisma.user.findUnique({
      where: { id: otherUser.id },
    });

    expect(stillThere?.role).toBe("DEMO");
  });

  it("creates the comments, replies and likes from the seed data", async () => {
    await seedDatabase(prisma, admin);

    const publishedPosts = seedPosts.filter((post) => post.published);

    expect(await prisma.comment.count()).toBe(
      publishedPosts.reduce(
        (total, post) => total + countComments(post.comments),
        0,
      ),
    );
    expect(await prisma.postLike.count()).toBe(
      publishedPosts.reduce((total, post) => total + post.likes.length, 0),
    );
    expect(
      await prisma.comment.count({ where: { parentId: { not: null } } }),
    ).toBeGreaterThan(0);
  });

  it("attributes comments to the admin and the readers", async () => {
    await seedDatabase(prisma, admin);

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: admin.email },
    });
    const authors = new Set(
      (await prisma.comment.findMany({ select: { authorId: true } })).map(
        (comment) => comment.authorId,
      ),
    );

    expect(authors.has(adminUser.id)).toBe(true);
    expect(authors.size).toBeGreaterThan(1);
  });

  it("sets cover images and dates relative to the run date", async () => {
    const now = new Date("2026-11-04T09:30:00.000Z");

    await seedDatabase(prisma, admin, now);

    for (const seedPost of seedPosts) {
      const post = await prisma.post.findUniqueOrThrow({
        where: { slug: seedPost.slug },
      });
      const expectedCreatedAt =
        Date.UTC(2026, 10, 4, 12) - seedPost.daysAgo * 24 * 60 * 60 * 1000;

      expect(post.createdAt.getTime()).toBe(expectedCreatedAt);
      expect(post.coverImageUrl).toBe(
        seedPost.coverFile ? `/demo/covers/${seedPost.coverFile}` : null,
      );

      if (seedPost.updatedDaysAgo !== null) {
        expect(post.updatedAt.getTime()).toBeGreaterThan(
          post.createdAt.getTime(),
        );
      } else {
        expect(post.updatedAt.getTime()).toBe(post.createdAt.getTime());
      }
    }
  });

  it("keeps comments after the posts are re-seeded with the same ids", async () => {
    await seedDatabase(prisma, admin);
    const commentIds = (await prisma.comment.findMany({ select: { id: true } }))
      .map((comment) => comment.id)
      .sort();

    await seedDatabase(prisma, admin);

    expect(
      (await prisma.comment.findMany({ select: { id: true } }))
        .map((comment) => comment.id)
        .sort(),
    ).toEqual(commentIds);
  });
});
