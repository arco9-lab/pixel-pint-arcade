import { describe, expect, it, vi } from "vitest";

import { prisma } from "@/db/prisma";
import {
  createTestPost,
  createTestUser,
} from "@/tests/integration/factories";

const authMock = vi.hoisted(() => {
  const state = {
    currentUser: null as null | {
      id: string;
      name: string;
      email: string;
      image: string | null;
      role: "USER" | "ADMIN" | "DEMO";
    },
  };

  const requireRecord = async () => {
    if (!state.currentUser) {
      throw new Error("Unauthorized");
    }

    return state.currentUser;
  };

  return { state, requireRecord };
});

vi.mock("@/server/permissions", () => ({
  requireUserRecord: vi.fn(authMock.requireRecord),
  requireAdmin: vi.fn(async () => {
    const user = await authMock.requireRecord();

    if (user.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    return user;
  }),
  requirePostAuthor: vi.fn(async () => {
    const user = await authMock.requireRecord();

    if (user.role !== "ADMIN" && user.role !== "DEMO") {
      throw new Error("Forbidden");
    }

    return user;
  }),
}));

import {
  createPost,
  deletePost,
  getCurrentUserPostCount,
  getPostForEdit,
  getPublishedPostBySlug,
  getPublishedPostCount,
  getPublishedPosts,
  getRelatedPosts,
  updatePost,
} from "@/features/blog/data/posts";
import { createComment } from "@/features/comments/data/comments";
import {
  togglePostBookmark,
  togglePostLike,
} from "@/features/blog/data/post-engagement";

async function signIn(role: "USER" | "ADMIN" | "DEMO") {
  const user = await createTestUser({ role });
  authMock.state.currentUser = user;

  return user;
}

const demoPostInput = (overrides?: Partial<Parameters<typeof createPost>[0]>) => ({
  title: "Demo Post",
  slug: "demo-post",
  content: "Demo content",
  published: true,
  ...overrides,
});

describe("demo post creation rules", () => {
  it("rejects the fourth post and allows a new one after a delete", async () => {
    const demo = await signIn("DEMO");

    for (const index of [1, 2, 3]) {
      await createPost(demoPostInput({ slug: `demo-post-${index}` }));
    }

    await expect(createPost(demoPostInput())).rejects.toThrow("DemoPostLimit");
    await expect(getCurrentUserPostCount()).resolves.toBe(3);

    const [firstPost] = await prisma.post.findMany({
      where: { authorId: demo.id },
    });
    await deletePost(firstPost.id);
    await expect(createPost(demoPostInput())).resolves.toBeUndefined();
    await expect(getCurrentUserPostCount()).resolves.toBe(3);
  });

  it("never exceeds the limit under concurrent creation", async () => {
    await signIn("DEMO");

    const results = await Promise.allSettled(
      [1, 2, 3, 4, 5].map((index) =>
        createPost(demoPostInput({ slug: `parallel-${index}` })),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(3);
    expect(await prisma.post.count()).toBe(3);
  });

  it("applies the limit per demo user", async () => {
    await signIn("DEMO");
    for (const index of [1, 2, 3]) {
      await createPost(demoPostInput({ slug: `first-${index}` }));
    }

    await signIn("DEMO");

    await expect(createPost(demoPostInput())).resolves.toBeUndefined();
  });

  it("adds a suffix to the slug and keeps comments disabled", async () => {
    const demo = await signIn("DEMO");

    await createPost(demoPostInput({ commentsEnabled: true }));
    await createPost(demoPostInput());

    const posts = await prisma.post.findMany({ where: { authorId: demo.id } });

    expect(posts).toHaveLength(2);
    posts.forEach((post) => {
      expect(post.slug).toMatch(/^demo-post-[0-9a-f]{6}$/);
      expect(post.commentsEnabled).toBe(false);
    });
    expect(posts[0].slug).not.toBe(posts[1].slug);
  });

  it("does not suffix or restrict admin posts", async () => {
    await signIn("ADMIN");

    await createPost(demoPostInput({ slug: "admin-post", commentsEnabled: true }));

    await expect(
      prisma.post.findUnique({ where: { slug: "admin-post" } }),
    ).resolves.toMatchObject({ commentsEnabled: true });
  });

  it("rejects users with the USER role", async () => {
    await signIn("USER");

    await expect(createPost(demoPostInput())).rejects.toThrow("Forbidden");
  });

  it("accepts only gallery covers for demo posts", async () => {
    await signIn("DEMO");

    await expect(
      createPost(
        demoPostInput({
          slug: "gallery",
          coverImageUrl: "/demo/covers/arcade-night.png",
        }),
      ),
    ).resolves.toBeUndefined();

    for (const coverImageUrl of [
      "https://store.public.blob.vercel-storage.com/posts/cover.png",
      "/uploads/posts/cover.png",
      "https://example.com/cover.png",
    ]) {
      await expect(
        createPost(demoPostInput({ slug: "foreign", coverImageUrl })),
      ).rejects.toThrow("InvalidDemoCover");
    }
  });
});

describe("demo post ownership", () => {
  it("lets a demo user edit and delete only their own posts", async () => {
    const owner = await signIn("DEMO");
    const ownPost = await createTestPost({ authorId: owner.id, slug: "own-post" });
    const otherDemo = await createTestUser({ role: "DEMO" });
    const otherPost = await createTestPost({
      authorId: otherDemo.id,
      slug: "other-demo-post",
    });

    await expect(
      updatePost(ownPost.id, demoPostInput({ title: "Renamed", slug: "ignored" })),
    ).resolves.toMatchObject({ slug: "own-post" });
    await expect(
      updatePost(otherPost.id, demoPostInput()),
    ).rejects.toThrow("NotOwner");
    await expect(deletePost(otherPost.id)).rejects.toThrow("NotOwner");
    await expect(
      prisma.post.findUnique({ where: { id: otherPost.id } }),
    ).resolves.not.toBeNull();
    await expect(deletePost(ownPost.id)).resolves.toMatchObject({
      slug: "own-post",
    });
  });

  it("keeps comments disabled when a demo user edits a post", async () => {
    const owner = await signIn("DEMO");
    const post = await createTestPost({ authorId: owner.id });

    await updatePost(post.id, demoPostInput({ commentsEnabled: true }));

    await expect(
      prisma.post.findUnique({ where: { id: post.id } }),
    ).resolves.toMatchObject({ commentsEnabled: false });
  });

  it("loads a post for editing only for its demo author", async () => {
    const owner = await signIn("DEMO");
    const post = await createTestPost({ authorId: owner.id });

    await expect(getPostForEdit(post.id)).resolves.toMatchObject({ id: post.id });

    await signIn("DEMO");

    await expect(getPostForEdit(post.id)).resolves.toBeNull();
  });

  it("lets admins manage demo posts", async () => {
    const demo = await createTestUser({ role: "DEMO" });
    const post = await createTestPost({ authorId: demo.id });
    await signIn("ADMIN");

    await expect(getPostForEdit(post.id)).resolves.toMatchObject({ id: post.id });
    await expect(deletePost(post.id)).resolves.toBeDefined();
  });
});

describe("demo post visibility", () => {
  async function seedPosts() {
    const admin = await createTestUser({ role: "ADMIN" });
    const demo = await createTestUser({ role: "DEMO" });
    const publicPost = await createTestPost({
      authorId: admin.id,
      slug: "public-post",
      title: "Shared retro topic",
      tags: ["Retro"],
    });
    const demoPost = await createTestPost({
      authorId: demo.id,
      slug: "demo-private-post",
      title: "Shared retro topic from demo",
      tags: ["Retro"],
      commentsEnabled: false,
    });

    return { admin, demo, publicPost, demoPost };
  }

  it("hides demo posts from guests in the feed, count and search", async () => {
    await seedPosts();
    authMock.state.currentUser = null;

    const posts = await getPublishedPosts({ viewerId: null });

    expect(posts.map((post) => post.slug)).toEqual(["public-post"]);
    await expect(getPublishedPostCount({ viewerId: null })).resolves.toBe(1);
    await expect(
      getPublishedPosts({ query: "demo", viewerId: null }),
    ).resolves.toHaveLength(0);
  });

  it("hides demo posts from other users", async () => {
    await seedPosts();
    const stranger = await createTestUser({ role: "DEMO" });

    const posts = await getPublishedPosts({ viewerId: stranger.id });

    expect(posts.map((post) => post.slug)).toEqual(["public-post"]);
    await expect(
      getPublishedPostBySlug("demo-private-post", stranger.id),
    ).resolves.toBeNull();
    await expect(getPublishedPostBySlug("demo-private-post")).resolves.toBeNull();
  });

  it("shows demo posts to their author with a marker", async () => {
    const { demo } = await seedPosts();

    const posts = await getPublishedPosts({ viewerId: demo.id });
    const demoPost = posts.find((post) => post.slug === "demo-private-post");

    expect(posts).toHaveLength(2);
    expect(demoPost?.visibleOnlyToAuthor).toBe(true);
    expect(
      posts.find((post) => post.slug === "public-post")?.visibleOnlyToAuthor,
    ).toBe(false);
    await expect(getPublishedPostCount({ viewerId: demo.id })).resolves.toBe(2);
    await expect(
      getPublishedPostBySlug("demo-private-post", demo.id),
    ).resolves.toMatchObject({ slug: "demo-private-post" });
    await expect(
      getPublishedPosts({ query: "demo", viewerId: demo.id }),
    ).resolves.toHaveLength(1);
  });

  it("never lists demo posts as related posts", async () => {
    const { demo, publicPost, demoPost } = await seedPosts();

    const relatedToPublic = await getRelatedPosts({
      postId: publicPost.id,
      tagSlugs: ["retro"],
    });
    const relatedToDemo = await getRelatedPosts({
      postId: demoPost.id,
      tagSlugs: ["retro"],
    });

    expect(relatedToPublic).toHaveLength(0);
    expect(relatedToDemo.map((post) => post.slug)).toEqual(["public-post"]);
    expect(demo.role).toBe("DEMO");
  });

  it("blocks likes, bookmarks and comments on other users' demo posts", async () => {
    const { demoPost } = await seedPosts();
    await signIn("USER");

    await expect(togglePostLike(demoPost.id)).rejects.toThrow("Post not found");
    await expect(togglePostBookmark(demoPost.id)).rejects.toThrow("Post not found");
    await expect(
      createComment({ postId: demoPost.id, body: "Hello" }),
    ).rejects.toThrow("Post not found");
  });

  it("lets the author like and bookmark their own demo post", async () => {
    const { demo, demoPost } = await seedPosts();
    authMock.state.currentUser = {
      ...demo,
      image: null,
    };

    await expect(togglePostLike(demoPost.id)).resolves.toMatchObject({
      liked: true,
    });
    await expect(togglePostBookmark(demoPost.id)).resolves.toMatchObject({
      bookmarked: true,
    });
    await expect(
      createComment({ postId: demoPost.id, body: "Hello" }),
    ).rejects.toThrow("Comments closed");
  });
});
