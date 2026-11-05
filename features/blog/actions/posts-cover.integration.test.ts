import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import { demoCovers } from "@/features/demo/covers";
import {
  createTestPost,
  createTestUser,
  idFormData,
  postFormData,
} from "@/tests/integration/factories";

const blobMock = vi.hoisted(() => ({
  del: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  currentUser: null as null | {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: "USER" | "ADMIN" | "DEMO";
  },
}));

vi.mock("@vercel/blob", () => ({
  del: blobMock.del,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/permissions", () => ({
  requireAdmin: vi.fn(async () => {
    if (authMock.currentUser?.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    return authMock.currentUser;
  }),
  requirePostAuthor: vi.fn(async () => {
    if (
      authMock.currentUser?.role !== "ADMIN" &&
      authMock.currentUser?.role !== "DEMO"
    ) {
      throw new Error("Forbidden");
    }

    return authMock.currentUser;
  }),
  requireUserRecord: vi.fn(async () => authMock.currentUser),
}));

import {
  createPostAction,
  deletePostAction,
  updatePostAction,
} from "@/features/blog/actions/posts";

const blobCoverUrl =
  "https://store123.public.blob.vercel-storage.com/posts/cover-abc.png";
const otherBlobCoverUrl =
  "https://store123.public.blob.vercel-storage.com/posts/cover-def.png";

describe("post cover image actions", () => {
  beforeEach(async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-token");
    blobMock.del.mockReset();
    blobMock.del.mockResolvedValue(undefined);
    authMock.currentUser = await createTestUser({ role: "ADMIN" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores a blob cover url on create", async () => {
    await expect(
      createPostAction(
        { ok: false },
        postFormData({ slug: "blob-cover", coverImageUrl: blobCoverUrl }),
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      prisma.post.findUnique({ where: { slug: "blob-cover" } }),
    ).resolves.toMatchObject({ coverImageUrl: blobCoverUrl });
  });

  it("stores a demo gallery cover path on create", async () => {
    await expect(
      createPostAction(
        { ok: false },
        postFormData({
          slug: "gallery-cover",
          coverImageUrl: demoCovers[0].url,
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    await expect(
      prisma.post.findUnique({ where: { slug: "gallery-cover" } }),
    ).resolves.toMatchObject({ coverImageUrl: demoCovers[0].url });
  });

  it.each([
    "https://example.com/cover.png",
    "/uploads/posts/cover.png",
    "/demo/covers/../secret.png",
    "/demo/covers/nonexistent.webp",
  ])("rejects the foreign cover url %s", async (coverImageUrl) => {
    await expect(
      createPostAction(
        { ok: false },
        postFormData({ slug: "foreign-cover", coverImageUrl }),
      ),
    ).resolves.toMatchObject({
      ok: false,
      errors: { coverImageUrl: expect.any(Array) },
    });
    expect(await prisma.post.count()).toBe(0);
  });

  it("deletes the previous blob when the cover is replaced", async () => {
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await expect(
      updatePostAction(
        { ok: false },
        postFormData({
          postId: post.id,
          slug: "replaced-cover",
          coverImageUrl: otherBlobCoverUrl,
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(blobMock.del).toHaveBeenCalledTimes(1);
    expect(blobMock.del).toHaveBeenCalledWith(blobCoverUrl);
    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toMatchObject({ coverImageUrl: otherBlobCoverUrl });
  });

  it("keeps the cover and the blob when no new cover is submitted", async () => {
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await updatePostAction(
      { ok: false },
      postFormData({ postId: post.id, slug: "same-cover" }),
    );

    expect(blobMock.del).not.toHaveBeenCalled();
    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toMatchObject({ coverImageUrl: blobCoverUrl });
  });

  it("deletes the blob when the cover is removed", async () => {
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await expect(
      updatePostAction(
        { ok: false },
        postFormData({
          postId: post.id,
          slug: "removed-cover",
          removeCoverImage: true,
        }),
      ),
    ).resolves.toMatchObject({ ok: true });

    expect(blobMock.del).toHaveBeenCalledWith(blobCoverUrl);
    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toMatchObject({ coverImageUrl: null });
  });

  it("deletes the blob when the post is deleted", async () => {
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await expect(
      deletePostAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({ ok: true });

    expect(blobMock.del).toHaveBeenCalledWith(blobCoverUrl);
  });

  it("does not call Blob for gallery covers", async () => {
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: demoCovers[0].url,
    });

    await deletePostAction({ ok: false }, idFormData("postId", post.id));

    expect(blobMock.del).not.toHaveBeenCalled();
  });

  it("does not call Blob when the token is not configured", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await deletePostAction({ ok: false }, idFormData("postId", post.id));

    expect(blobMock.del).not.toHaveBeenCalled();
  });

  it("still deletes the post when Blob deletion fails", async () => {
    blobMock.del.mockRejectedValue(new Error("blob unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const post = await createTestPost({
      authorId: authMock.currentUser!.id,
      coverImageUrl: blobCoverUrl,
    });

    await expect(
      deletePostAction({ ok: false }, idFormData("postId", post.id)),
    ).resolves.toMatchObject({ ok: true });
    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toBeNull();
  });
});
