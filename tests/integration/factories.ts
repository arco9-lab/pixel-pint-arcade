import { prisma } from "@/db/prisma";

type TestRole = "USER" | "ADMIN" | "DEMO";

export async function createTestUser(options?: {
  id?: string;
  email?: string;
  name?: string;
  role?: TestRole;
}) {
  const id =
    options?.id ??
    `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return prisma.user.create({
    data: {
      id,
      email: options?.email ?? `${id}@example.test`,
      name: options?.name ?? "Test User",
      role: options?.role ?? "USER",
    },
  });
}

export async function createTestPost(options: {
  authorId: string;
  title?: string;
  slug?: string;
  content?: string;
  published?: boolean;
  commentsEnabled?: boolean;
  tags?: string[];
  coverImageUrl?: string | null;
}) {
  const slug =
    options.slug ??
    `post-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return prisma.post.create({
    data: {
      title: options.title ?? "Test Post",
      slug,
      excerpt: "Test excerpt",
      content: options.content ?? "Test content",
      coverImageUrl: options.coverImageUrl,
      published: options.published ?? true,
      commentsEnabled: options.commentsEnabled ?? true,
      author: {
        connect: { id: options.authorId },
      },
      ...(options.tags?.length
        ? {
            tags: {
              connectOrCreate: options.tags.map((name) => {
                const tagSlug = name
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "");

                return {
                  where: { slug: tagSlug },
                  create: { name, slug: tagSlug },
                };
              }),
            },
          }
        : {}),
    },
  });
}

export async function createTestComment(options: {
  authorId: string;
  postId: string;
  body?: string;
  parentId?: string | null;
  createdAt?: Date;
}) {
  return prisma.comment.create({
    data: {
      authorId: options.authorId,
      postId: options.postId,
      parentId: options.parentId,
      body: options.body ?? "Test comment",
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    },
  });
}

export function postFormData(input: {
  postId?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  tags?: string;
  content?: string;
  published?: boolean;
  commentsEnabled?: boolean;
  coverImageUrl?: string;
  removeCoverImage?: boolean;
}) {
  const formData = new FormData();

  if (input.coverImageUrl) {
    formData.set("coverImageUrl", input.coverImageUrl);
  }

  if (input.removeCoverImage) {
    formData.set("removeCoverImage", "on");
  }

  if (input.postId) {
    formData.set("postId", input.postId);
  }

  formData.set("title", input.title ?? "Action Post");
  formData.set("slug", input.slug ?? "action-post");
  formData.set("excerpt", input.excerpt ?? "Action excerpt");
  formData.set("tags", input.tags ?? "Action, Test");
  formData.set("content", input.content ?? "Action content");
  formData.set("coverImageAlt", "");
  formData.set("seoTitle", "");
  formData.set("seoDescription", "");

  if (input.published ?? true) {
    formData.set("published", "on");
  }

  if (input.commentsEnabled ?? true) {
    formData.set("commentsEnabled", "on");
  }

  return formData;
}

export function commentFormData(input: {
  postId: string;
  postSlug?: string;
  parentId?: string | null;
  body?: string;
  website?: string;
}) {
  const formData = new FormData();

  formData.set("postId", input.postId);
  formData.set("postSlug", input.postSlug ?? "test-post");
  formData.set("body", input.body ?? "Action comment");

  if (input.parentId) {
    formData.set("parentId", input.parentId);
  }

  if (input.website) {
    formData.set("website", input.website);
  }

  return formData;
}

export function idFormData(name: string, value: string, extra?: Record<string, string>) {
  const formData = new FormData();

  formData.set(name, value);

  Object.entries(extra ?? {}).forEach(([key, item]) => {
    formData.set(key, item);
  });

  return formData;
}
