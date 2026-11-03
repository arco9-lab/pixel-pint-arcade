import { hashPassword } from "better-auth/crypto";

import type { PrismaClient } from "../../app/generated/prisma/client";
import { seedPosts } from "./posts";
import {
  seedCommentBodies,
  seedReaders,
  seedReplyBodies,
} from "./readers";

export type SeedAdminInput = {
  email: string;
  name: string;
  password: string;
};

const slugifyTag = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const hoursAfter = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * 60 * 60 * 1000);

async function seedAdmin(prisma: PrismaClient, admin: SeedAdminInput) {
  const user = await prisma.user.upsert({
    where: { email: admin.email },
    update: { name: admin.name, role: "ADMIN", emailVerified: true },
    create: {
      id: "seed-admin",
      email: admin.email,
      name: admin.name,
      role: "ADMIN",
      emailVerified: true,
    },
  });

  const password = await hashPassword(admin.password);

  await prisma.account.upsert({
    where: { id: `${user.id}-credential` },
    update: { password },
    create: {
      id: `${user.id}-credential`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password,
    },
  });

  return user;
}

async function seedReaderUsers(prisma: PrismaClient) {
  return Promise.all(
    seedReaders.map((reader) =>
      prisma.user.upsert({
        where: { id: reader.id },
        update: { name: reader.name },
        create: {
          id: reader.id,
          name: reader.name,
          email: reader.email,
          emailVerified: true,
          role: "USER",
        },
      }),
    ),
  );
}

async function seedPostRecords(prisma: PrismaClient, authorId: string) {
  const tagNames = new Map<string, string>();

  seedPosts.forEach((post) =>
    post.tags.forEach((name) => tagNames.set(slugifyTag(name), name)),
  );

  await Promise.all(
    [...tagNames].map(([slug, name]) =>
      prisma.tag.upsert({
        where: { slug },
        update: { name },
        create: { slug, name },
      }),
    ),
  );

  return Promise.all(
    seedPosts.map((post) => {
      const createdAt = new Date(post.createdAt);
      const updatedAt = post.updatedAt ? new Date(post.updatedAt) : createdAt;
      const data = {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImageUrl: post.coverImageUrl,
        coverImageAlt: post.coverImageAlt,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        published: post.published,
        commentsEnabled: post.commentsEnabled,
        createdAt,
        updatedAt,
        tags: {
          set: post.tags.map((name) => ({ slug: slugifyTag(name) })),
        },
      };

      return prisma.post.upsert({
        where: { slug: post.slug },
        update: data,
        create: {
          ...data,
          slug: post.slug,
          authorId,
          tags: {
            connect: post.tags.map((name) => ({ slug: slugifyTag(name) })),
          },
        },
      });
    }),
  );
}

async function seedEngagement(
  prisma: PrismaClient,
  posts: Awaited<ReturnType<typeof seedPostRecords>>,
  readerIds: string[],
) {
  const publishedPosts = posts.filter((post) => post.published);

  for (const [postIndex, post] of publishedPosts.entries()) {
    for (const [readerIndex, readerId] of readerIds.entries()) {
      if ((postIndex + readerIndex) % 2 === 0) {
        await prisma.postLike.upsert({
          where: { id: `seed-like-${postIndex}-${readerIndex}` },
          update: {},
          create: {
            id: `seed-like-${postIndex}-${readerIndex}`,
            postId: post.id,
            userId: readerId,
            createdAt: hoursAfter(post.createdAt, 2 + readerIndex),
          },
        });
      }

      if ((postIndex + readerIndex) % 3 === 0) {
        await prisma.postBookmark.upsert({
          where: { id: `seed-bookmark-${postIndex}-${readerIndex}` },
          update: {},
          create: {
            id: `seed-bookmark-${postIndex}-${readerIndex}`,
            postId: post.id,
            userId: readerId,
            createdAt: hoursAfter(post.createdAt, 3 + readerIndex),
          },
        });
      }
    }

    if (!post.commentsEnabled) {
      continue;
    }

    const rootId = `seed-comment-${postIndex}-root`;
    const rootAuthorId = readerIds[postIndex % readerIds.length];
    const rootCreatedAt = hoursAfter(post.createdAt, 5);

    await prisma.comment.upsert({
      where: { id: rootId },
      update: {},
      create: {
        id: rootId,
        postId: post.id,
        authorId: rootAuthorId,
        body: seedCommentBodies[postIndex % seedCommentBodies.length],
        createdAt: rootCreatedAt,
      },
    });

    const replyId = `seed-comment-${postIndex}-reply`;

    await prisma.comment.upsert({
      where: { id: replyId },
      update: {},
      create: {
        id: replyId,
        postId: post.id,
        parentId: rootId,
        authorId: readerIds[(postIndex + 1) % readerIds.length],
        body: seedReplyBodies[postIndex % seedReplyBodies.length],
        createdAt: hoursAfter(rootCreatedAt, 4),
      },
    });
  }
}

export async function seedDatabase(
  prisma: PrismaClient,
  admin: SeedAdminInput,
) {
  const adminUser = await seedAdmin(prisma, admin);
  const readers = await seedReaderUsers(prisma);
  const posts = await seedPostRecords(prisma, adminUser.id);

  await seedEngagement(
    prisma,
    posts,
    readers.map((reader) => reader.id),
  );
}
