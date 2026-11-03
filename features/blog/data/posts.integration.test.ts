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
  requireAdmin: vi.fn(async () => {
    if (!authMock.currentUser) {
      throw new Error("Unauthorized");
    }

    if (authMock.currentUser.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    return authMock.currentUser;
  }),
}));

import {
  createPost,
  deletePost,
  getAdminPostForEdit,
  getPublishedPostBySlug,
  getPublishedPostCount,
  getPublishedPosts,
  getRelatedPosts,
  updatePost,
} from "@/features/blog/data/posts";

async function signIn(role: "USER" | "ADMIN" | "DEMO") {
  const user = await createTestUser({ role });
  authMock.currentUser = user;

  return user;
}

describe("blog post data functions", () => {
  it("returns only published posts and supports search", async () => {
    const admin = await signIn("ADMIN");

    await createTestPost({
      authorId: admin.id,
      title: "Arcade Cabinet Notes",
      slug: "arcade-cabinet-notes",
      content: "CRT monitor setup",
      published: true,
      tags: ["Hardware"],
    });
    await createTestPost({
      authorId: admin.id,
      title: "Hidden Draft",
      slug: "hidden-draft",
      published: false,
      tags: ["Draft"],
    });

    await expect(getPublishedPostCount()).resolves.toBe(1);
    await expect(getPublishedPosts({ query: "hardware" })).resolves.toHaveLength(1);
    await expect(getPublishedPosts({ query: "draft" })).resolves.toHaveLength(0);
  });

  it("does not return drafts by slug", async () => {
    const admin = await signIn("ADMIN");
    await createTestPost({
      authorId: admin.id,
      slug: "draft-post",
      published: false,
    });

    await expect(getPublishedPostBySlug("draft-post")).resolves.toBeNull();
  });

  it("finds related published posts by shared tags", async () => {
    const admin = await signIn("ADMIN");
    const source = await createTestPost({
      authorId: admin.id,
      slug: "source-post",
      tags: ["Arcade", "Hardware"],
    });
    const related = await createTestPost({
      authorId: admin.id,
      slug: "related-post",
      tags: ["Hardware"],
    });
    await createTestPost({
      authorId: admin.id,
      slug: "unrelated-post",
      tags: ["RPG"],
    });

    const posts = await getRelatedPosts({
      postId: source.id,
      tagSlugs: ["hardware"],
    });

    expect(posts.map((post) => post.id)).toEqual([related.id]);
  });

  it("rejects guests and non-admin users when creating posts", async () => {
    authMock.currentUser = null;
    await expect(
      createPost({
        title: "Guest Post",
        slug: "guest-post",
        content: "Content",
      }),
    ).rejects.toThrow("Unauthorized");

    await signIn("USER");
    await expect(
      createPost({
        title: "User Post",
        slug: "user-post",
        content: "Content",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("allows admins to create, update, and delete posts", async () => {
    const admin = await signIn("ADMIN");

    await createPost({
      title: "Admin Post",
      slug: "admin-post",
      content: "Original content",
      published: true,
      tags: "Arcade, Hardware",
    });

    const createdPost = await prisma.post.findUniqueOrThrow({
      where: { slug: "admin-post" },
      include: { tags: true },
    });

    expect(createdPost.authorId).toBe(admin.id);
    expect(createdPost.tags.map((tag) => tag.slug).sort()).toEqual([
      "arcade",
      "hardware",
    ]);

    await expect(getAdminPostForEdit(createdPost.id)).resolves.toMatchObject({
      slug: "admin-post",
      published: true,
    });

    await expect(
      updatePost(createdPost.id, {
        title: "Updated Admin Post",
        slug: "updated-admin-post",
        content: "Updated content",
        published: false,
        tags: "Updated",
      }),
    ).resolves.toEqual({
      previousSlug: "admin-post",
      slug: "updated-admin-post",
    });

    await expect(deletePost(createdPost.id)).resolves.toEqual({
      slug: "updated-admin-post",
    });
    await expect(
      prisma.post.findUnique({ where: { id: createdPost.id } }),
    ).resolves.toBeNull();
  });
});
