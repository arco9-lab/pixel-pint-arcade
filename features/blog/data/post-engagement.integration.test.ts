import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
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
  getCurrentUserSavedPosts,
  getPostEngagement,
  togglePostBookmark,
  togglePostLike,
} from "@/features/blog/data/post-engagement";

async function signIn() {
  const user = await createTestUser();
  authMock.currentUser = user;

  return user;
}

describe("post engagement data functions", () => {
  it("rejects guests when toggling likes or bookmarks", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    authMock.currentUser = null;

    await expect(togglePostLike(post.id)).rejects.toThrow("Unauthorized");
    await expect(togglePostBookmark(post.id)).rejects.toThrow("Unauthorized");
  });

  it("toggles likes and reports engagement state", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    await expect(getPostEngagement(post.id, user.id)).resolves.toEqual({
      likesCount: 0,
      likedByCurrentUser: false,
      bookmarkedByCurrentUser: false,
    });

    await expect(togglePostLike(post.id)).resolves.toEqual({
      liked: true,
      slug: post.slug,
    });
    await expect(getPostEngagement(post.id, user.id)).resolves.toMatchObject({
      likesCount: 1,
      likedByCurrentUser: true,
    });

    await expect(togglePostLike(post.id)).resolves.toEqual({
      liked: false,
      slug: post.slug,
    });
    await expect(prisma.postLike.count({ where: { postId: post.id } })).resolves.toBe(
      0,
    );
  });

  it("toggles bookmarks and lists current user's saved posts", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({ authorId: admin.id });
    const user = await signIn();

    await expect(togglePostBookmark(post.id)).resolves.toEqual({
      bookmarked: true,
      slug: post.slug,
    });
    await expect(getPostEngagement(post.id, user.id)).resolves.toMatchObject({
      bookmarkedByCurrentUser: true,
    });
    await expect(getCurrentUserSavedPosts()).resolves.toEqual([
      expect.objectContaining({
        id: post.id,
        slug: post.slug,
      }),
    ]);

    await expect(togglePostBookmark(post.id)).resolves.toEqual({
      bookmarked: false,
      slug: post.slug,
    });
    await expect(getCurrentUserSavedPosts()).resolves.toEqual([]);
  });

  it("rejects engagement toggles for draft posts", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    const post = await createTestPost({
      authorId: admin.id,
      published: false,
    });
    await signIn();

    await expect(togglePostLike(post.id)).rejects.toThrow("Post not found");
    await expect(togglePostBookmark(post.id)).rejects.toThrow("Post not found");
  });
});
