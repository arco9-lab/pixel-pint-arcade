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

  it("deletes a comment without replies completely", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    const comment = await createTestComment({
      authorId: user.id,
      postId: post.id,
    });

    await deleteComment(comment.id);

    expect(await prisma.comment.count()).toBe(0);
  });

  it("turns a comment with replies into a tombstone", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const replier = await createTestUser();
    const user = await signIn();
    const comment = await createTestComment({
      authorId: user.id,
      postId: post.id,
      body: "Original text",
    });
    const reply = await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: comment.id,
      body: "Reply text",
    });

    await deleteComment(comment.id);

    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: comment.id } }),
    ).resolves.toMatchObject({
      body: "",
      authorId: user.id,
      deletedAt: expect.any(Date),
    });
    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: reply.id } }),
    ).resolves.toMatchObject({ body: "Reply text", parentId: comment.id });

    const comments = await getCommentsForPost(post.id);

    expect(comments).toHaveLength(2);
    expect(comments.find((item) => item.id === comment.id)).toMatchObject({
      body: "",
      author: null,
      deleted: true,
    });
    expect(comments.find((item) => item.id === reply.id)).toMatchObject({
      body: "Reply text",
      author: { id: replier.id },
      deleted: false,
    });
  });

  it("lets an admin delete a foreign comment while keeping its replies", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const author = await createTestUser();
    const replier = await createTestUser();
    const comment = await createTestComment({
      authorId: author.id,
      postId: post.id,
    });
    const reply = await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: comment.id,
    });
    authMock.currentUser = admin;

    await deleteComment(comment.id);

    await expect(
      prisma.comment.findUniqueOrThrow({ where: { id: comment.id } }),
    ).resolves.toMatchObject({ body: "", deletedAt: expect.any(Date) });
    await expect(
      prisma.comment.findUnique({ where: { id: reply.id } }),
    ).resolves.not.toBeNull();
  });

  it("removes a tombstone together with its last reply", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const author = await createTestUser();
    const replier = await createTestUser();
    const comment = await createTestComment({
      authorId: author.id,
      postId: post.id,
    });
    const reply = await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: comment.id,
    });
    authMock.currentUser = author;
    await deleteComment(comment.id);
    authMock.currentUser = replier;

    await deleteComment(reply.id);

    expect(await prisma.comment.count()).toBe(0);
  });

  it("removes a whole chain of tombstones when its last leaf is deleted", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const rootAuthor = await createTestUser();
    const middleAuthor = await createTestUser();
    const leafAuthor = await createTestUser();
    const root = await createTestComment({
      authorId: rootAuthor.id,
      postId: post.id,
    });
    const middle = await createTestComment({
      authorId: middleAuthor.id,
      postId: post.id,
      parentId: root.id,
    });
    const leaf = await createTestComment({
      authorId: leafAuthor.id,
      postId: post.id,
      parentId: middle.id,
    });
    authMock.currentUser = rootAuthor;
    await deleteComment(root.id);
    authMock.currentUser = middleAuthor;
    await deleteComment(middle.id);

    expect(await prisma.comment.count()).toBe(3);

    authMock.currentUser = leafAuthor;
    await deleteComment(leaf.id);

    expect(await prisma.comment.count()).toBe(0);
  });

  it("keeps a tombstone while it still has other replies", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const author = await createTestUser();
    const firstReplier = await createTestUser();
    const secondReplier = await createTestUser();
    const comment = await createTestComment({
      authorId: author.id,
      postId: post.id,
    });
    const firstReply = await createTestComment({
      authorId: firstReplier.id,
      postId: post.id,
      parentId: comment.id,
    });
    await createTestComment({
      authorId: secondReplier.id,
      postId: post.id,
      parentId: comment.id,
    });
    authMock.currentUser = author;
    await deleteComment(comment.id);
    authMock.currentUser = firstReplier;

    await deleteComment(firstReply.id);

    expect(await prisma.comment.count()).toBe(2);
    await expect(
      prisma.comment.findUnique({ where: { id: comment.id } }),
    ).resolves.not.toBeNull();
  });

  it("reports a deleted comment as not found", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const replier = await createTestUser();
    const user = await signIn();
    const comment = await createTestComment({
      authorId: user.id,
      postId: post.id,
    });
    await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: comment.id,
    });
    await deleteComment(comment.id);

    await expect(deleteComment(comment.id)).rejects.toThrow("Comment not found");
  });

  it("rejects replies to a tombstone", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const replier = await createTestUser();
    const author = await signIn();
    const comment = await createTestComment({
      authorId: author.id,
      postId: post.id,
    });
    await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: comment.id,
    });
    await deleteComment(comment.id);
    const newcomer = await signIn();

    await expect(
      createComment({
        postId: post.id,
        parentId: comment.id,
        body: `Reply from ${newcomer.id}`,
      }),
    ).rejects.toThrow("Parent comment not found");
  });

  it("hides tombstones from the current user's comments", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const replier = await createTestUser();
    const user = await signIn();
    const deleted = await createTestComment({
      authorId: user.id,
      postId: post.id,
      body: "Deleted with reply",
    });
    await createTestComment({
      authorId: replier.id,
      postId: post.id,
      parentId: deleted.id,
    });
    await createTestComment({
      authorId: user.id,
      postId: post.id,
      body: "Still visible",
    });
    await deleteComment(deleted.id);

    const comments = await getCurrentUserComments();

    expect(comments.map((comment) => comment.body)).toEqual(["Still visible"]);
  });

  it("never loses a reply posted while its parent is being deleted", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const parentAuthor = await createTestUser();
    const replier = await createTestUser();
    const parent = await createTestComment({
      authorId: parentAuthor.id,
      postId: post.id,
    });
    await Promise.all(
      Array.from({ length: 5 }, () => prisma.$queryRaw`SELECT 1`),
    );

    authMock.currentUser = parentAuthor;
    const deletion = deleteComment(parent.id);
    authMock.currentUser = replier;
    const reply = createComment({
      postId: post.id,
      parentId: parent.id,
      body: "Racing reply",
    });

    const [, replyResult] = await Promise.allSettled([deletion, reply]);

    if (replyResult.status === "fulfilled") {
      await expect(
        prisma.comment.findUnique({ where: { id: replyResult.value.id } }),
      ).resolves.not.toBeNull();
    }
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
