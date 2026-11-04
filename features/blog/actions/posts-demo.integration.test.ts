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

const savePostCoverImageMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/storage", () => ({
  savePostCoverImage: savePostCoverImageMock,
}));

vi.mock("@/server/permissions", () => ({
  requirePostAuthor: vi.fn(async () => {
    if (!authMock.currentUser) {
      throw new Error("Unauthorized");
    }

    if (authMock.currentUser.role === "USER") {
      throw new Error("Forbidden");
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

describe("demo post actions", () => {
  it("creates up to three posts and then reports the limit", async () => {
    await signIn("DEMO");

    for (const index of [1, 2, 3]) {
      await expect(
        createPostAction(
          { ok: false },
          postFormData({ slug: `demo-action-${index}` }),
        ),
      ).resolves.toMatchObject({ ok: true });
    }

    await expect(
      createPostAction({ ok: false }, postFormData({ slug: "demo-action-4" })),
    ).resolves.toMatchObject({
      ok: false,
      message: "Demo accounts can have up to 3 posts.",
    });
  });

  it("never stores an uploaded file for demo users", async () => {
    await signIn("DEMO");
    const formData = postFormData({ slug: "upload-attempt" });
    formData.set("coverImageFile", new File(["x"], "cover.png", { type: "image/png" }));

    await expect(createPostAction({ ok: false }, formData)).resolves.toMatchObject({
      ok: true,
    });
    expect(savePostCoverImageMock).not.toHaveBeenCalled();
  });

  it("rejects covers outside the gallery with a field error", async () => {
    await signIn("DEMO");

    await expect(
      createPostAction(
        { ok: false },
        postFormData({
          slug: "foreign-cover",
          coverImageUrl:
            "https://store.public.blob.vercel-storage.com/posts/cover.png",
        }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      errors: { coverImageUrl: ["Choose a cover from the gallery."] },
    });
    expect(await prisma.post.count()).toBe(0);
  });

  it("keeps the gallery cover when editing a demo post", async () => {
    const demo = await signIn("DEMO");
    const post = await createTestPost({
      authorId: demo.id,
      coverImageUrl: "/demo/covers/arcade-night.png",
    });

    await expect(
      updatePostAction(
        { ok: false },
        postFormData({ postId: post.id, coverImageUrl: "/demo/covers/arcade-night.png" }),
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toMatchObject({ coverImageUrl: "/demo/covers/arcade-night.png" });
  });

  it("reports ownership errors when touching another user's post", async () => {
    const other = await createTestUser({ role: "DEMO" });
    const post = await createTestPost({ authorId: other.id });
    await signIn("DEMO");

    await expect(
      updatePostAction({ ok: false }, postFormData({ postId: post.id })),
    ).resolves.toMatchObject({
      ok: false,
      message: "You can edit only your own posts.",
    });
    await expect(
      deletePostAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({
      ok: false,
      message: "You can delete only your own posts.",
    });
  });

  it("still rejects users with the USER role", async () => {
    await signIn("USER");

    await expect(
      createPostAction({ ok: false }, postFormData({ slug: "user-post" })),
    ).resolves.toMatchObject({
      ok: false,
      message: "Only admins can create posts.",
    });
  });
});
