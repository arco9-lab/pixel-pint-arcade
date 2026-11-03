import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
  createTestPost,
  createTestUser,
  idFormData,
  postFormData,
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
  requireAdmin: vi.fn(async () => {
    if (!authMock.currentUser) {
      throw new Error("Unauthorized");
    }

    if (authMock.currentUser.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    return authMock.currentUser;
  }),
  requireUserRecord: vi.fn(async () => {
    if (!authMock.currentUser) {
      throw new Error("Unauthorized");
    }

    return authMock.currentUser;
  }),
}));

import {
  createPostAction,
  deletePostAction,
  updatePostAction,
} from "@/features/blog/actions/posts";

async function signIn(role: "USER" | "ADMIN" | "DEMO") {
  const user = await createTestUser({ role });
  authMock.currentUser = user;

  return user;
}

describe("blog post server actions", () => {
  it("rejects guests and non-admin users when creating posts", async () => {
    authMock.currentUser = null;
    await expect(
      createPostAction({ ok: false }, postFormData({ slug: "guest-action" })),
    ).resolves.toMatchObject({
      ok: false,
      message: "Sign in before creating a post.",
    });

    await signIn("USER");
    await expect(
      createPostAction({ ok: false }, postFormData({ slug: "user-action" })),
    ).resolves.toMatchObject({
      ok: false,
      message: "Only admins can create posts.",
    });
  });

  it("allows admins to create, update, and delete posts", async () => {
    const admin = await signIn("ADMIN");

    await expect(
      createPostAction(
        { ok: false },
        postFormData({ slug: "admin-action-post" }),
      ),
    ).resolves.toMatchObject({ ok: true });

    const post = await prisma.post.findUniqueOrThrow({
      where: { slug: "admin-action-post" },
    });

    expect(post.authorId).toBe(admin.id);

    await expect(
      updatePostAction(
        { ok: false },
        postFormData({
          postId: post.id,
          title: "Updated Action Post",
          slug: "updated-action-post",
          published: false,
        }),
      ),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.post.findUnique({ where: { slug: "updated-action-post" } }),
    ).resolves.toMatchObject({ published: false });

    await expect(
      deletePostAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toBeNull();
  });

  it("rejects non-admin users when editing or deleting posts", async () => {
    const admin = await signIn("ADMIN");
    const post = await createTestPost({ authorId: admin.id });

    await signIn("USER");

    await expect(
      updatePostAction(
        { ok: false },
        postFormData({ postId: post.id, slug: "blocked-edit" }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      message: "Only admins can edit posts.",
    });
    await expect(
      deletePostAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({
      ok: false,
      message: "Only admins can delete posts.",
    });
  });
});
