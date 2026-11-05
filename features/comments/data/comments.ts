import "server-only";

import { prisma } from "@/db/prisma";
import { getPublishedVisibleToViewerWhere } from "@/features/blog/data/post-visibility";
import { requireUserRecord } from "@/server/permissions";
import type {
  AccountCommentDTO,
  CommentDTO,
} from "@/features/comments/types";

const commentSelect = {
  id: true,
  body: true,
  postId: true,
  parentId: true,
  createdAt: true,
  deletedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      image: true,
    },
  },
} as const;

const toCommentDTO = (comment: {
  id: string;
  body: string;
  postId: string;
  parentId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  author: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}): CommentDTO => {
  const { deletedAt, ...visibleFields } = comment;
  const createdAt = comment.createdAt.toISOString();

  if (deletedAt) {
    return {
      ...visibleFields,
      body: "",
      author: null,
      createdAt,
      deleted: true,
    };
  }

  return { ...visibleFields, createdAt, deleted: false };
};

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
    select: commentSelect,
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

  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('comment-author'), hashtext(${user.id}))`;

    const latestComment = await transaction.comment.findFirst({
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
      normalizeCommentBody(latestComment.body) ===
        normalizeCommentBody(input.body)
    ) {
      throw new Error("Duplicate comment");
    }

    if (countCommentLinks(input.body) > MAX_COMMENT_LINKS) {
      throw new Error("Too many comment links");
    }

    if (input.parentId) {
      const parent = await transaction.comment.findFirst({
        where: {
          id: input.parentId,
          postId: input.postId,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!parent) {
        throw new Error("Parent comment not found");
      }
    }

    const comment = await transaction.comment.create({
      data: {
        body: input.body,
        postId: input.postId,
        parentId: input.parentId,
        authorId: user.id,
      },
      select: commentSelect,
    });

    return toCommentDTO(comment);
  });
};

export const getCurrentUserComments = async (): Promise<AccountCommentDTO[]> => {
  const user = await requireUserRecord();
  const comments = await prisma.comment.findMany({
    where: { authorId: user.id, deletedAt: null },
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

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT id FROM "Comment" WHERE id = ${commentId} FOR UPDATE`;

    const comment = await transaction.comment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        parentId: true,
        _count: { select: { replies: true } },
      },
    });

    if (!comment) {
      throw new Error("Comment not found");
    }

    if (comment.authorId !== user.id && user.role !== "ADMIN") {
      throw new Error("Forbidden");
    }

    if (comment._count.replies > 0) {
      await transaction.comment.update({
        where: { id: comment.id },
        data: { body: "", deletedAt: new Date() },
      });

      return;
    }

    await transaction.comment.delete({ where: { id: comment.id } });

    let ancestorId = comment.parentId;

    while (ancestorId) {
      await transaction.$executeRaw`SELECT id FROM "Comment" WHERE id = ${ancestorId} FOR UPDATE`;

      const ancestor = await transaction.comment.findUnique({
        where: { id: ancestorId },
        select: {
          id: true,
          deletedAt: true,
          parentId: true,
          _count: { select: { replies: true } },
        },
      });

      if (!ancestor?.deletedAt || ancestor._count.replies > 0) {
        break;
      }

      await transaction.comment.delete({ where: { id: ancestor.id } });
      ancestorId = ancestor.parentId;
    }
  });
};
