import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
  createTestComment,
  createTestPost,
  createTestUser,
} from "@/tests/integration/factories";

const authMock = vi.hoisted(() => ({
  currentUser: null as null | {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "USER" | "ADMIN" | "DEMO";
  },
}));

vi.mock("@/server/permissions", () => ({
  requireUserRecord: vi.fn(async () => {
    if (!authMock.currentUser) {
      throw new Error("Unauthorized");
    }

    return authMock.currentUser;
  }),
}));

import {
  createComment,
  deleteComment,
  getCommentsForPost,
  getCurrentUserComments,
} from "@/features/comments/data/comments";

async function signIn(role: "USER" | "ADMIN" | "DEMO" = "USER") {
  const user = await createTestUser({ role });
  authMock.currentUser = user;

  return user;
}

describe("comment data functions", () => {
  it("rejects guests when creating comments", async () => {
    const author = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: author.id });
    authMock.currentUser = null;

    await expect(
      createComment({ postId: post.id, body: "Guest comment" }),
    ).rejects.toThrow("Unauthorized");
  });

  it("creates comments for signed-in users on published posts", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    await expect(
      createComment({ postId: post.id, body: "Published comment" }),
    ).resolves.toMatchObject({
      body: "Published comment",
      author: { id: user.id },
    });

    await expect(getCommentsForPost(post.id)).resolves.toHaveLength(1);
    await expect(getCurrentUserComments()).resolves.toHaveLength(1);
  });

  it("rejects comments on closed posts", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({
      authorId: admin.id,
      commentsEnabled: false,
    });
    await signIn();

    await expect(
      createComment({ postId: post.id, body: "Closed comment" }),
    ).rejects.toThrow("Comments closed");
  });

  it("rejects replies whose parent belongs to another post", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({
      authorId: admin.id,
      slug: "comment-post",
    });
    const otherPost = await createTestPost({
      authorId: admin.id,
      slug: "other-comment-post",
    });
    const parentAuthor = await createTestUser();
    const parent = await createTestComment({
      authorId: parentAuthor.id,
      postId: otherPost.id,
    });
    await signIn();

    await expect(
      createComment({
        postId: post.id,
        parentId: parent.id,
        body: "Cross-post reply",
      }),
    ).rejects.toThrow("Parent comment not found");
  });

  it("rate-limits repeated comments from the same user", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    await createTestComment({
      authorId: user.id,
      postId: post.id,
      body: "Recent comment",
    });

    await expect(
      createComment({ postId: post.id, body: "Too soon" }),
    ).rejects.toThrow("Comment rate limited");
  });

  it("enforces the rate limit under parallel requests", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    await Promise.all(
      Array.from({ length: 5 }, () => prisma.$queryRaw`SELECT 1`),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, index) =>
        createComment({ postId: post.id, body: `Parallel comment ${index}` }),
      ),
    );

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(rejected).toHaveLength(4);
    rejected.forEach((result) => {
      expect(result.reason).toMatchObject({ message: "Comment rate limited" });
    });
    expect(await prisma.comment.count({ where: { authorId: user.id } })).toBe(1);
  });

  it("rejects parallel duplicates", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    const results = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        createComment({ postId: post.id, body: "Same parallel body" }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(await prisma.comment.count({ where: { authorId: user.id } })).toBe(1);
  });

  it("does not block other users", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const firstUser = await createTestUser();
    const secondUser = await createTestUser();

    const createAs = (user: typeof firstUser, body: string) => {
      authMock.currentUser = user;

      return createComment({ postId: post.id, body });
    };

    const results = await Promise.allSettled([
      createAs(firstUser, "First user comment"),
      createAs(secondUser, "Second user comment"),
    ]);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await prisma.comment.count({ where: { postId: post.id } })).toBe(2);
  });

  it("rejects duplicate last comments after the rate-limit window", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    await createTestComment({
      authorId: user.id,
      postId: post.id,
      body: "Same body",
      createdAt: new Date(Date.now() - 31_000),
    });

    await expect(
      createComment({ postId: post.id, body: " same   body " }),
    ).rejects.toThrow("Duplicate comment");
  });

  it("rejects comments with more than two links", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    await signIn();

    await expect(
      createComment({
        postId: post.id,
        body: "Links https://a.test https://b.test www.c.test",
      }),
    ).rejects.toThrow("Too many comment links");
  });

  it("allows comment authors or admins to delete comments", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    const comment = await createTestComment({
      authorId: user.id,
      postId: post.id,
    });

    await expect(deleteComment(comment.id)).resolves.toBeUndefined();
    await expect(
      prisma.comment.findUnique({ where: { id: comment.id } }),
    ).resolves.toBeNull();

    const otherUser = await signIn();
    const adminDeletedComment = await createTestComment({
      authorId: otherUser.id,
      postId: post.id,
    });
    authMock.currentUser = admin;

    await expect(deleteComment(adminDeletedComment.id)).resolves.toBeUndefined();
  });

  it("rejects non-owners when deleting comments", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const owner = await createTestUser();
    const comment = await createTestComment({
      authorId: owner.id,
      postId: post.id,
    });
    await signIn();

    await expect(deleteComment(comment.id)).rejects.toThrow("Forbidden");
  });
});
