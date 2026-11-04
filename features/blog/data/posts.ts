import "server-only";

import { randomBytes } from "node:crypto";

import { prisma } from "@/db/prisma";
import {
  requireAdmin,
  requirePostAuthor,
  requireUserRecord,
} from "@/server/permissions";
import { isDemoCoverUrl } from "@/features/blog/cover-image";
import {
  getPublishedVisibleToViewerWhere,
} from "@/features/blog/data/post-visibility";
import { DEMO_POST_LIMIT } from "@/features/demo/constants";
import { tagConnectOrCreate } from "@/features/blog/validators/tags";
import type {
  AccountPostDTO,
  AdminPostEditDTO,
  PostDetailDTO,
  PostListItemDTO,
} from "@/features/blog/types";

const postListSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  createdAt: true,
  updatedAt: true,
  commentsEnabled: true,
  tags: {
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
    },
  },
  author: {
    select: {
      name: true,
      image: true,
      role: true,
    },
  },
} as const;

const toPostListItemDTO = (post: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  createdAt: Date;
  updatedAt: Date;
  commentsEnabled: boolean;
  tags: {
    name: string;
    slug: string;
  }[];
  author: {
    name: string;
    image: string | null;
    role: string;
  };
}): PostListItemDTO => {
  const { author, ...rest } = post;

  return {
    ...rest,
    author: { name: author.name, image: author.image },
    visibleOnlyToAuthor: author.role === "DEMO",
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
};

const getSearchWhere = (search: string) => ({
  OR: [
    { title: { contains: search, mode: "insensitive" as const } },
    { excerpt: { contains: search, mode: "insensitive" as const } },
    { seoTitle: { contains: search, mode: "insensitive" as const } },
    { seoDescription: { contains: search, mode: "insensitive" as const } },
    { content: { contains: search, mode: "insensitive" as const } },
    {
      tags: {
        some: {
          name: { contains: search, mode: "insensitive" as const },
        },
      },
    },
  ],
});

const getPublishedPostWhere = (query?: string, viewerId?: string | null) => {
  const search = query?.trim();

  return {
    AND: [
      ...getPublishedVisibleToViewerWhere(viewerId).AND,
      ...(search ? [getSearchWhere(search)] : []),
    ],
  };
};

export const getPublishedPosts = async (options?: {
  query?: string;
  take?: number;
  skip?: number;
  viewerId?: string | null;
}): Promise<PostListItemDTO[]> => {
  const posts = await prisma.post.findMany({
    where: getPublishedPostWhere(options?.query, options?.viewerId),
    orderBy: { createdAt: "desc" },
    take: options?.take,
    skip: options?.skip,
    select: postListSelect,
  });

  return posts.map(toPostListItemDTO);
};

export const getPublishedPostCount = async (options?: {
  query?: string;
  viewerId?: string | null;
}): Promise<number> =>
  prisma.post.count({
    where: getPublishedPostWhere(options?.query, options?.viewerId),
  });

export const getPublishedPostBySlug = async (
  slug: string,
  viewerId?: string | null,
): Promise<PostDetailDTO | null> => {
  const post = await prisma.post.findFirst({
    where: {
      AND: [{ slug }, ...getPublishedVisibleToViewerWhere(viewerId).AND],
    },
    select: {
      ...postListSelect,
      content: true,
      seoTitle: true,
      seoDescription: true,
    },
  });

  if (!post) {
    return null;
  }

  return {
    ...toPostListItemDTO(post),
    content: post.content,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
  };
};

export const getRelatedPosts = async (options: {
  postId: string;
  tagSlugs: string[];
  take?: number;
}): Promise<PostListItemDTO[]> => {
  if (options.tagSlugs.length === 0) {
    return [];
  }

  const posts = await prisma.post.findMany({
    where: {
      id: { not: options.postId },
      published: true,
      author: { role: { not: "DEMO" } },
      tags: {
        some: {
          slug: { in: options.tagSlugs },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 3,
    select: postListSelect,
  });

  return posts.map(toPostListItemDTO);
};

export const getCurrentUserPosts = async (): Promise<AccountPostDTO[]> => {
  const user = await requireUserRecord();
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImageUrl: true,
      coverImageAlt: true,
      seoTitle: true,
      seoDescription: true,
      published: true,
      commentsEnabled: true,
      tags: {
        orderBy: { name: "asc" },
        select: {
          name: true,
          slug: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  });

  return posts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }));
};

const postForEditSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  seoTitle: true,
  seoDescription: true,
  content: true,
  published: true,
  commentsEnabled: true,
  tags: {
    orderBy: { name: "asc" },
    select: {
      name: true,
      slug: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

const toAdminPostEditDTO = (post: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  content: string;
  published: boolean;
  commentsEnabled: boolean;
  tags: { name: string; slug: string }[];
  createdAt: Date;
  updatedAt: Date;
}): AdminPostEditDTO => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

export const getAdminPostForEdit = async (
  postId: string,
): Promise<AdminPostEditDTO | null> => {
  await requireAdmin();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: postForEditSelect,
  });

  return post ? toAdminPostEditDTO(post) : null;
};

export const getPostForEdit = async (
  postId: string,
): Promise<AdminPostEditDTO | null> => {
  const user = await requirePostAuthor();

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      ...(user.role === "DEMO" ? { authorId: user.id } : {}),
    },
    select: postForEditSelect,
  });

  return post ? toAdminPostEditDTO(post) : null;
};

export const getCurrentUserPostCount = async (): Promise<number> => {
  const user = await requireUserRecord();

  return prisma.post.count({ where: { authorId: user.id } });
};

type PostInput = {
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string | null;
  content: string;
  published?: boolean;
  commentsEnabled?: boolean;
};

const createDemoSlug = (base: string) =>
  `${base.slice(0, 160).replace(/-+$/, "")}-${randomBytes(3).toString("hex")}`;

const assertDemoCover = (coverImageUrl?: string | null) => {
  if (coverImageUrl && !isDemoCoverUrl(coverImageUrl)) {
    throw new Error("InvalidDemoCover");
  }
};

export const createPost = async (input: PostInput) => {
  const author = await requirePostAuthor();
  const isDemo = author.role === "DEMO";
  const tags = tagConnectOrCreate(input.tags);

  if (isDemo) {
    assertDemoCover(input.coverImageUrl);
  }

  const data = {
    title: input.title,
    slug: isDemo ? createDemoSlug(input.slug) : input.slug,
    excerpt: input.excerpt,
    coverImageUrl: input.coverImageUrl,
    coverImageAlt: input.coverImageAlt,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    content: input.content,
    published: input.published ?? false,
    commentsEnabled: isDemo ? false : (input.commentsEnabled ?? true),
    author: {
      connect: { id: author.id },
    },
    ...(tags.length > 0
      ? {
          tags: {
            connectOrCreate: tags,
          },
        }
      : {}),
  };

  if (!isDemo) {
    await prisma.post.create({ data });
    return;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${author.id}))`;

    const existingPosts = await transaction.post.count({
      where: { authorId: author.id },
    });

    if (existingPosts >= DEMO_POST_LIMIT) {
      throw new Error("DemoPostLimit");
    }

    await transaction.post.create({ data });
  });
};

export const updatePost = async (postId: string, input: PostInput) => {
  const user = await requirePostAuthor();
  const isDemo = user.role === "DEMO";
  const tags = tagConnectOrCreate(input.tags);
  const currentPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true, coverImageUrl: true, authorId: true },
  });

  if (!currentPost) {
    throw new Error("NotFound");
  }

  if (isDemo) {
    if (currentPost.authorId !== user.id) {
      throw new Error("NotOwner");
    }

    assertDemoCover(input.coverImageUrl);
  }

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      title: input.title,
      slug: isDemo ? currentPost.slug : input.slug,
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: input.coverImageAlt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      content: input.content,
      published: input.published ?? false,
      commentsEnabled: isDemo ? false : (input.commentsEnabled ?? true),
      ...(input.tags !== undefined
        ? {
            tags: {
              set: [],
              connectOrCreate: tags,
            },
          }
        : {}),
    },
    select: { slug: true, coverImageUrl: true },
  });

  return {
    previousSlug: currentPost.slug,
    slug: updatedPost.slug,
    previousCoverImageUrl: currentPost.coverImageUrl,
    coverImageUrl: updatedPost.coverImageUrl,
  };
};

export const deletePost = async (postId: string) => {
  const user = await requirePostAuthor();

  if (user.role === "DEMO") {
    const ownedPost = await prisma.post.findFirst({
      where: { id: postId, authorId: user.id },
      select: { id: true },
    });

    if (!ownedPost) {
      throw new Error("NotOwner");
    }
  }

  const deletedPost = await prisma.post.delete({
    where: { id: postId },
    select: { slug: true, coverImageUrl: true },
  });

  return {
    slug: deletedPost.slug,
    coverImageUrl: deletedPost.coverImageUrl,
  };
};
