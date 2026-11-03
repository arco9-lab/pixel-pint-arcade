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
