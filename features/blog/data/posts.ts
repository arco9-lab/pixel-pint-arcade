import "server-only";

import { prisma } from "@/db/prisma";
import { requireAdmin, requireUserRecord } from "@/server/permissions";
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
  };
}): PostListItemDTO => ({
  ...post,
  createdAt: post.createdAt.toISOString(),
  updatedAt: post.updatedAt.toISOString(),
});

const getPublishedPostWhere = (query?: string) => {
  const search = query?.trim();

  return {
    published: true,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { excerpt: { contains: search, mode: "insensitive" as const } },
            { seoTitle: { contains: search, mode: "insensitive" as const } },
            {
              seoDescription: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            { content: { contains: search, mode: "insensitive" as const } },
            {
              tags: {
                some: {
                  name: { contains: search, mode: "insensitive" as const },
                },
              },
            },
          ],
        }
      : {}),
  };
};

export const getPublishedPosts = async (options?: {
  query?: string;
  take?: number;
  skip?: number;
}): Promise<PostListItemDTO[]> => {
  const posts = await prisma.post.findMany({
    where: getPublishedPostWhere(options?.query),
    orderBy: { createdAt: "desc" },
    take: options?.take,
    skip: options?.skip,
    select: postListSelect,
  });

  return posts.map(toPostListItemDTO);
};

export const getPublishedPostCount = async (options?: {
  query?: string;
}): Promise<number> =>
  prisma.post.count({
    where: getPublishedPostWhere(options?.query),
  });

export const getPublishedPostBySlug = async (
  slug: string,
): Promise<PostDetailDTO | null> => {
  const post = await prisma.post.findFirst({
    where: { slug, published: true },
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

export const getAdminPostForEdit = async (
  postId: string,
): Promise<AdminPostEditDTO | null> => {
  await requireAdmin();

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
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
    },
  });

  if (!post) {
    return null;
  }

  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
};

export const createPost = async (input: {
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
}) => {
  const admin = await requireAdmin();
  const tags = tagConnectOrCreate(input.tags);

  await prisma.post.create({
    data: {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: input.coverImageAlt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      content: input.content,
      published: input.published ?? false,
      commentsEnabled: input.commentsEnabled ?? true,
      author: {
        connect: { id: admin.id },
      },
      ...(tags.length > 0
        ? {
            tags: {
              connectOrCreate: tags,
            },
          }
        : {}),
    },
  });
};

export const updatePost = async (
  postId: string,
  input: {
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
  },
) => {
  await requireAdmin();
  const tags = tagConnectOrCreate(input.tags);
  const currentPost = await prisma.post.findUnique({
    where: { id: postId },
    select: { slug: true, coverImageUrl: true },
  });

  if (!currentPost) {
    throw new Error("NotFound");
  }

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl,
      coverImageAlt: input.coverImageAlt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      content: input.content,
      published: input.published ?? false,
      commentsEnabled: input.commentsEnabled ?? true,
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
  await requireAdmin();

  const deletedPost = await prisma.post.delete({
    where: { id: postId },
    select: { slug: true, coverImageUrl: true },
  });

  return {
    slug: deletedPost.slug,
    coverImageUrl: deletedPost.coverImageUrl,
  };
};
