import { describe, expect, it } from "vitest";

import { prisma } from "@/db/prisma";
import { createTestPost, createTestUser } from "@/tests/integration/factories";
import { seedPosts } from "./posts";
import { seedReaders } from "./readers";
import { seedDatabase } from "./seed-database";

const admin = {
  email: "seed-admin@example.test",
  name: "Seed Admin",
  password: "seed-admin-password",
};

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
});
