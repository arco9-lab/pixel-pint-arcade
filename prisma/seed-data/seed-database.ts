import { hashPassword } from "better-auth/crypto";

import type { PrismaClient } from "../../app/generated/prisma/client";
import { seedPosts } from "./posts";
import { SEED_ADMIN_ALIAS, seedReaders } from "./readers";
import type { SeedComment } from "./types";

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

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;
const COMMENT_SPACING_HOURS = 5;

const hoursAfter = (date: Date, hours: number) =>
  new Date(date.getTime() + hours * HOUR_IN_MILLISECONDS);

const daysBefore = (now: Date, days: number) =>
  new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12) -
      days * DAY_IN_MILLISECONDS,
  );

const flattenComments = (
  comments: SeedComment[],
  parentKey: string | null = null,
): { comment: SeedComment; parentKey: string | null }[] =>
  comments.flatMap((comment) => [
    { comment, parentKey },
    ...flattenComments(comment.replies ?? [], comment.key),
  ]);

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

async function seedPostRecords(
  prisma: PrismaClient,
  authorId: string,
  now: Date,
) {
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
    seedPosts.map(async (post) => {
      const createdAt = daysBefore(now, post.daysAgo);
      const updatedAt =
        post.updatedDaysAgo === null
          ? createdAt
          : daysBefore(now, post.updatedDaysAgo);
      const data = {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        coverImageUrl: post.coverFile
          ? `/demo/covers/${post.coverFile}`
          : null,
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

      const record = await prisma.post.upsert({
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

      return { post, record };
    }),
  );
}

async function seedEngagement(
  prisma: PrismaClient,
  posts: Awaited<ReturnType<typeof seedPostRecords>>,
  userIdByAlias: Map<string, string>,
  now: Date,
) {
  const resolveUserId = (alias: string) => {
    const userId = userIdByAlias.get(alias);

    if (!userId) {
      throw new Error(`Unknown seed user "${alias}"`);
    }

    return userId;
  };

  for (const { post, record } of posts) {
    if (!post.published) {
      continue;
    }

    for (const [likeIndex, alias] of post.likes.entries()) {
      const id = `seed-like-${post.number}-${alias}`;

      await prisma.postLike.upsert({
        where: { id },
        update: {},
        create: {
          id,
          postId: record.id,
          userId: resolveUserId(alias),
          createdAt: hoursAfter(record.createdAt, 2 + likeIndex),
        },
      });
    }

    const flatComments = flattenComments(post.comments);

    for (const [index, { comment, parentKey }] of flatComments.entries()) {
      const createdAt = new Date(
        Math.min(
          hoursAfter(
            record.createdAt,
            COMMENT_SPACING_HOURS * (index + 1),
          ).getTime(),
          now.getTime(),
        ),
      );
      const data = {
        postId: record.id,
        authorId: resolveUserId(comment.author),
        parentId: parentKey ? `seed-comment-${parentKey}` : null,
        body: comment.body,
        createdAt,
      };

      await prisma.comment.upsert({
        where: { id: `seed-comment-${comment.key}` },
        update: data,
        create: { id: `seed-comment-${comment.key}`, ...data },
      });
    }
  }
}

export async function seedDatabase(
  prisma: PrismaClient,
  admin: SeedAdminInput,
  now: Date = new Date(),
) {
  const adminUser = await seedAdmin(prisma, admin);
  const readers = await seedReaderUsers(prisma);
  const posts = await seedPostRecords(prisma, adminUser.id, now);
  const userIdByAlias = new Map<string, string>([
    [SEED_ADMIN_ALIAS, adminUser.id],
    ...readers.map((reader, index) => [seedReaders[index].alias, reader.id] as const),
  ]);

  await seedEngagement(prisma, posts, userIdByAlias, now);
}
