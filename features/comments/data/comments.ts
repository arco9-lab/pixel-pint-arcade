import "server-only";

import { prisma } from "@/db/prisma";
import { getPublishedVisibleToViewerWhere } from "@/features/blog/data/post-visibility";
import { requireUserRecord } from "@/server/permissions";
import type {
  AccountCommentDTO,
  CommentDTO,
} from "@/features/comments/types";

const toCommentDTO = (comment: {
  id: string;
  body: string;
  postId: string;
  parentId: string | null;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
}): CommentDTO => ({
  ...comment,
  createdAt: comment.createdAt.toISOString(),
});

const COMMENT_RATE_LIMIT_MS = 30_000;
const MAX_COMMENT_LINKS = 2;

const normalizeCommentBody = (body: string) =>
  body.trim().replace(/\s+/g, " ").toLowerCase();

const countCommentLinks = (body: string) =>
  body.match(/\b(?:https?:\/\/|www\.)\S+/gi)?.length ?? 0;

export const getCommentsForPost = async (
  postId: string,
): Promise<CommentDTO[]> => {
  const comments = await prisma.comment.findMany({
    where: {
      postId,
      post: {
        published: true,
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      postId: true,
      parentId: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return comments.map(toCommentDTO);
};

export const createComment = async (input: {
  postId: string;
  parentId?: string | null;
  body: string;
}): Promise<CommentDTO> => {
  const user = await requireUserRecord();
  const post = await prisma.post.findFirst({
    where: {
      AND: [
        { id: input.postId },
        ...getPublishedVisibleToViewerWhere(user.id).AND,
      ],
    },
    select: {
      commentsEnabled: true,
      id: true,
    },
  });

  if (!post) {
    throw new Error("Post not found");
  }

  if (!post.commentsEnabled) {
    throw new Error("Comments closed");
  }

  const latestComment = await prisma.comment.findFirst({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      body: true,
      createdAt: true,
    },
  });

  if (
    latestComment &&
    Date.now() - latestComment.createdAt.getTime() < COMMENT_RATE_LIMIT_MS
  ) {
    throw new Error("Comment rate limited");
  }

  if (
    latestComment &&
    normalizeCommentBody(latestComment.body) === normalizeCommentBody(input.body)
  ) {
    throw new Error("Duplicate comment");
  }

  if (countCommentLinks(input.body) > MAX_COMMENT_LINKS) {
    throw new Error("Too many comment links");
  }

  if (input.parentId) {
    const parent = await prisma.comment.findFirst({
      where: {
        id: input.parentId,
        postId: input.postId,
      },
      select: { id: true },
    });

    if (!parent) {
      throw new Error("Parent comment not found");
    }
  }

  const comment = await prisma.comment.create({
    data: {
      body: input.body,
      postId: input.postId,
      parentId: input.parentId,
      authorId: user.id,
    },
    select: {
      id: true,
      body: true,
      postId: true,
      parentId: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
  });

  return toCommentDTO(comment);
};

export const getCurrentUserComments = async (): Promise<AccountCommentDTO[]> => {
  const user = await requireUserRecord();
  const comments = await prisma.comment.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      body: true,
      createdAt: true,
      post: {
        select: {
          title: true,
          slug: true,
          published: true,
        },
      },
    },
  });

  return comments.map((comment) => ({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
  }));
};

export const deleteComment = async (commentId: string) => {
  const user = await requireUserRecord();
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.authorId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  await prisma.comment.delete({
    where: { id: comment.id },
  });
};
