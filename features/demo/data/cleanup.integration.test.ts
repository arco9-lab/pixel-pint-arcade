import { describe, expect, it } from "vitest";

import { prisma } from "@/db/prisma";
import { deleteExpiredDemoUsers } from "@/features/demo/data/cleanup";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "@/tests/integration/factories";

const now = new Date("2026-11-03T12:00:00.000Z");
const hoursFromNow = (hours: number) =>
  new Date(now.getTime() + hours * 60 * 60 * 1000);

async function createDemoUser(demoExpiresAt: Date) {
  const user = await createTestUser({ role: "DEMO" });

  return prisma.user.update({
    where: { id: user.id },
    data: { demoExpiresAt },
  });
}

describe("deleteExpiredDemoUsers", () => {
  it("deletes expired demo users with their posts, comments and engagement", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const adminPost = await createTestPost({ authorId: admin.id });
    const expired = await createDemoUser(hoursFromNow(-1));
    const expiredPost = await createTestPost({
      authorId: expired.id,
      tags: ["Only Demo Tag"],
    });

    await createTestComment({ authorId: expired.id, postId: adminPost.id });
    await prisma.postLike.create({
      data: { postId: adminPost.id, userId: expired.id },
    });
    await prisma.postBookmark.create({
      data: { postId: adminPost.id, userId: expired.id },
    });
    await prisma.session.create({
      data: {
        id: "expired-demo-session",
        token: "expired-demo-token",
        userId: expired.id,
        expiresAt: hoursFromNow(24),
      },
    });

    const result = await deleteExpiredDemoUsers(now);

    expect(result).toMatchObject({ deletedUsers: 1, deletedPosts: 1 });
    expect(await prisma.user.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.post.findUnique({ where: { id: expiredPost.id } })).toBeNull();
    expect(await prisma.comment.count()).toBe(0);
    expect(await prisma.postLike.count()).toBe(0);
    expect(await prisma.postBookmark.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.tag.count()).toBe(0);
    expect(await prisma.post.findUnique({ where: { id: adminPost.id } })).not.toBeNull();
  });

  it("turns a demo comment with an admin reply into a tombstone", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const adminPost = await createTestPost({ authorId: admin.id });
    const expired = await createDemoUser(hoursFromNow(-1));
    const demoComment = await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
      body: "Demo question",
    });
    const adminReply = await createTestComment({
      authorId: admin.id,
      postId: adminPost.id,
      parentId: demoComment.id,
      body: "Admin answer",
    });

    const result = await deleteExpiredDemoUsers(now);

    expect(result).toMatchObject({
      deletedUsers: 1,
      deletedComments: 0,
      tombstonedComments: 1,
    });
    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: adminReply.id } }),
    ).resolves.toMatchObject({ body: "Admin answer", authorId: admin.id });
    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: demoComment.id } }),
    ).resolves.toMatchObject({
      body: "",
      authorId: null,
      deletedAt: expect.any(Date),
    });
  });

  it("keeps the admin reply in a demo, admin, demo chain", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const adminPost = await createTestPost({ authorId: admin.id });
    const expired = await createDemoUser(hoursFromNow(-1));
    const top = await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
    });
    const middle = await createTestComment({
      authorId: admin.id,
      postId: adminPost.id,
      parentId: top.id,
    });
    const bottom = await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
      parentId: middle.id,
    });

    await deleteExpiredDemoUsers(now);

    expect(
      await prisma.comment.findUnique({ where: { id: bottom.id } }),
    ).toBeNull();
    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: top.id } }),
    ).resolves.toMatchObject({ authorId: null, deletedAt: expect.any(Date) });
    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: middle.id } }),
    ).resolves.toMatchObject({ authorId: admin.id, deletedAt: null });
  });

  it("removes a whole chain that only the demo user took part in", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const adminPost = await createTestPost({ authorId: admin.id });
    const expired = await createDemoUser(hoursFromNow(-1));
    const top = await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
    });
    const reply = await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
      parentId: top.id,
    });
    await createTestComment({
      authorId: expired.id,
      postId: adminPost.id,
      parentId: reply.id,
    });

    const result = await deleteExpiredDemoUsers(now);

    expect(result).toMatchObject({ deletedComments: 3, tombstonedComments: 0 });
    expect(await prisma.comment.count()).toBe(0);
  });

  it("removes leftover tombstones that no longer have replies", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const adminPost = await createTestPost({ authorId: admin.id });
    const author = await createTestUser();
    const leftoverParent = await createTestComment({
      authorId: author.id,
      postId: adminPost.id,
    });
    const leftoverChild = await createTestComment({
      authorId: author.id,
      postId: adminPost.id,
      parentId: leftoverParent.id,
    });
    const liveComment = await createTestComment({
      authorId: author.id,
      postId: adminPost.id,
    });
    await prisma.comment.updateMany({
      where: { id: { in: [leftoverParent.id, leftoverChild.id] } },
      data: { body: "", deletedAt: now, authorId: null },
    });

    const result = await deleteExpiredDemoUsers(now);

    expect(result).toMatchObject({ deletedComments: 2 });
    expect(await prisma.comment.findMany({ select: { id: true } })).toEqual([
      { id: liveComment.id },
    ]);
  });

  it("keeps admins, readers and fresh demo users", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const reader = await createTestUser({ role: "USER" });
    const fresh = await createDemoUser(hoursFromNow(5));
    const sharedPost = await createTestPost({
      authorId: admin.id,
      tags: ["Shared Tag"],
    });
    await createTestComment({ authorId: fresh.id, postId: sharedPost.id });

    const result = await deleteExpiredDemoUsers(now);

    expect(result).toMatchObject({ deletedUsers: 0, deletedPosts: 0 });
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.user.findUnique({ where: { id: reader.id } })).not.toBeNull();
    expect(await prisma.comment.count()).toBe(1);
    expect(await prisma.tag.count()).toBe(1);
  });

  it("removes expired sessions and verifications only", async () => {
    const user = await createTestUser();

    await prisma.session.createMany({
      data: [
        {
          id: "old-session",
          token: "old-token",
          userId: user.id,
          expiresAt: hoursFromNow(-2),
        },
        {
          id: "live-session",
          token: "live-token",
          userId: user.id,
          expiresAt: hoursFromNow(2),
        },
      ],
    });
    await prisma.verification.createMany({
      data: [
        { id: "old-verification", identifier: "a", value: "1", expiresAt: hoursFromNow(-2) },
        { id: "live-verification", identifier: "b", value: "2", expiresAt: hoursFromNow(2) },
      ],
    });

    await deleteExpiredDemoUsers(now);

    const sessions = await prisma.session.findMany();
    const verifications = await prisma.verification.findMany();

    expect(sessions.map((session) => session.id)).toEqual(["live-session"]);
    expect(verifications.map((item) => item.id)).toEqual(["live-verification"]);
  });

  it("deletes demo posts but keeps tags still used by other posts", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    await createTestPost({ authorId: admin.id, tags: ["Shared Tag"] });
    const expired = await createDemoUser(hoursFromNow(-1));
    await createTestPost({
      authorId: expired.id,
      tags: ["Shared Tag", "Demo Only Tag"],
    });

    await deleteExpiredDemoUsers(now);

    const tags = await prisma.tag.findMany({ select: { slug: true } });

    expect(tags.map((tag) => tag.slug)).toEqual(["shared-tag"]);
    expect(await prisma.post.count()).toBe(1);
  });
});
