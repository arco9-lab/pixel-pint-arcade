import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
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
  togglePostBookmarkAction,
  togglePostLikeAction,
} from "@/features/blog/actions/post-engagement";

async function signIn() {
  const user = await createTestUser();
  authMock.currentUser = user;

  return user;
}

describe("post engagement server actions", () => {
  it("rejects guests", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    authMock.currentUser = null;

    await expect(
      togglePostLikeAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in before liking posts.",
    });
    await expect(
      togglePostBookmarkAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in before saving posts.",
    });
  });

  it("toggles likes and bookmarks for signed-in users", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    await expect(
      togglePostLikeAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.postLike.findUnique({
        where: { postId_userId: { postId: post.id, userId: user.id } },
      }),
    ).resolves.toBeTruthy();

    await expect(
      togglePostBookmarkAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.postBookmark.findUnique({
        where: { postId_userId: { postId: post.id, userId: user.id } },
      }),
    ).resolves.toBeTruthy();
  });
});
