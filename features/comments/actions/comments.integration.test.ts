import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
  commentFormData,
  createTestComment,
  createTestPost,
  createTestUser,
  idFormData,
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
  createCommentAction,
  deleteCommentAction,
} from "@/features/comments/actions/comments";

async function signIn(role: "USER" | "ADMIN" | "DEMO" = "USER") {
  const user = await createTestUser({ role });
  authMock.currentUser = user;

  return user;
}

describe("comment server actions", () => {
  it("rejects guests when creating comments", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    authMock.currentUser = null;

    await expect(
      createCommentAction({ ok: false }, commentFormData({ postId: post.id })),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in before posting a comment.",
    });
  });

  it("creates comments for signed-in users", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    await expect(
      createCommentAction(
        { ok: false },
        commentFormData({
          postId: post.id,
          postSlug: post.slug,
          body: "Action comment",
        }),
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.comment.findFirst({
        where: { authorId: user.id, body: "Action comment" },
      }),
    ).resolves.toBeTruthy();
  });

  it("returns action errors for closed comments and spam checks", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const closedPost = await createTestPost({
      authorId: admin.id,
      commentsEnabled: false,
    });
    const openPost = await createTestPost({
      authorId: admin.id,
      slug: "open-action-comments",
    });
    const user = await signIn();

    await expect(
      createCommentAction(
        { ok: false },
        commentFormData({ postId: closedPost.id }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      message: "Comments are closed for this post.",
    });

    await createTestComment({
      authorId: user.id,
      postId: openPost.id,
      body: "Recent action comment",
    });
    await expect(
      createCommentAction(
        { ok: false },
        commentFormData({ postId: openPost.id, body: "Too soon" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      message: "Please wait before posting another comment.",
    });
  });

  it("allows owners and admins to delete comments through actions", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();
    const comment = await createTestComment({
      authorId: user.id,
      postId: post.id,
    });

    await expect(
      deleteCommentAction(
        { ok: false },
        idFormData("commentId", comment.id, { postSlug: post.slug }),
      ),
    ).resolves.toMatchObject({ ok: true });

    const otherUser = await signIn();
    const adminDeletedComment = await createTestComment({
      authorId: otherUser.id,
      postId: post.id,
    });
    authMock.currentUser = admin;

    await expect(
      deleteCommentAction(
        { ok: false },
        idFormData("commentId", adminDeletedComment.id),
      ),
    ).resolves.toMatchObject({ ok: true });
  });
});
