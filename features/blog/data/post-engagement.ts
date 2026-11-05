import "server-only";

import { prisma } from "@/db/prisma";
import { getPublishedVisibleToViewerWhere } from "@/features/blog/data/post-visibility";
import { requireUserRecord } from "@/server/permissions";
import type {
  PostEngagementDTO,
  SavedPostDTO,
} from "@/features/blog/types";

export const getPostEngagement = async (
  postId: string,
  userId?: string,
): Promise<PostEngagementDTO> => {
  const [likesCount, like, bookmark] = await Promise.all([
    prisma.postLike.count({ where: { postId } }),
    userId
      ? prisma.postLike.findUnique({
          where: { postId_userId: { postId, userId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    userId
      ? prisma.postBookmark.findUnique({
          where: { postId_userId: { postId, userId } },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return {
    likesCount,
    likedByCurrentUser: Boolean(like),
    bookmarkedByCurrentUser: Boolean(bookmark),
  };
};

const requirePublishedPost = async (postId: string, viewerId: string) => {
  const post = await prisma.post.findFirst({
    where: {
      AND: [{ id: postId }, ...getPublishedVisibleToViewerWhere(viewerId).AND],
    },
    select: {
      id: true,
      slug: true,
    },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  return post;
};

export const togglePostLike = async (postId: string) => {
  const user = await requireUserRecord();
  const post = await requirePublishedPost(postId, user.id);
  const existingLike = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
    select: { id: true },
  });

  if (existingLike) {
    await prisma.postLike.delete({
      where: { id: existingLike.id },
    });

    return { liked: false, slug: post.slug };
  }

  await prisma.postLike.create({
    data: {
      postId,
      userId: user.id,
    },
  });

  return { liked: true, slug: post.slug };
};

export const togglePostBookmark = async (postId: string) => {
  const user = await requireUserRecord();
  const post = await requirePublishedPost(postId, user.id);
  const existingBookmark = await prisma.postBookmark.findUnique({
    where: { postId_userId: { postId, userId: user.id } },
    select: { id: true },
  });

  if (existingBookmark) {
    await prisma.postBookmark.delete({
      where: { id: existingBookmark.id },
    });

    return { bookmarked: false, slug: post.slug };
  }

  await prisma.postBookmark.create({
    data: {
      postId,
      userId: user.id,
    },
  });

  return { bookmarked: true, slug: post.slug };
};

export const getCurrentUserSavedPosts = async (): Promise<SavedPostDTO[]> => {
  const user = await requireUserRecord();
  const bookmarks = await prisma.postBookmark.findMany({
    where: {
      userId: user.id,
      post: {
        published: true,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      post: {
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          createdAt: true,
          author: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  return bookmarks.map((bookmark) => ({
    id: bookmark.post.id,
    savedAt: bookmark.createdAt.toISOString(),
    title: bookmark.post.title,
    slug: bookmark.post.slug,
    excerpt: bookmark.post.excerpt,
    createdAt: bookmark.post.createdAt.toISOString(),
    author: bookmark.post.author,
  }));
};
