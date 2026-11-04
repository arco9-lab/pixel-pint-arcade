import "server-only";

import { prisma } from "@/db/prisma";

export type DemoCleanupResult = {
  deletedUsers: number;
  deletedPosts: number;
  deletedComments: number;
  tombstonedComments: number;
  deletedTags: number;
};

const CLEANUP_TRANSACTION_TIMEOUT_MS = 30_000;

export async function deleteExpiredDemoUsers(
  now: Date = new Date(),
): Promise<DemoCleanupResult> {
  const expiredUsers = await prisma.user.findMany({
    where: { role: "DEMO", demoExpiresAt: { lt: now } },
    select: { id: true },
  });
  const expiredUserIds = expiredUsers.map((user) => user.id);

  const counts = await prisma.$transaction(
    async (transaction) => {
      const deletedPosts = await transaction.post.deleteMany({
        where: { authorId: { in: expiredUserIds } },
      });

      let deletedComments = 0;
      let deletedBatch = 0;

      do {
        deletedBatch = (
          await transaction.comment.deleteMany({
            where: {
              authorId: { in: expiredUserIds },
              replies: { none: {} },
            },
          })
        ).count;
        deletedComments += deletedBatch;
      } while (deletedBatch > 0);

      const tombstonedComments = await transaction.comment.updateMany({
        where: { authorId: { in: expiredUserIds }, deletedAt: null },
        data: { body: "", deletedAt: now },
      });

      const deletedUsers = await transaction.user.deleteMany({
        where: { id: { in: expiredUserIds } },
      });

      do {
        deletedBatch = (
          await transaction.comment.deleteMany({
            where: { deletedAt: { not: null }, replies: { none: {} } },
          })
        ).count;
        deletedComments += deletedBatch;
      } while (deletedBatch > 0);

      return {
        deletedPosts: deletedPosts.count,
        deletedUsers: deletedUsers.count,
        deletedComments,
        tombstonedComments: tombstonedComments.count,
      };
    },
    { timeout: CLEANUP_TRANSACTION_TIMEOUT_MS },
  );

  const deletedTags = await prisma.tag.deleteMany({
    where: { posts: { none: {} } },
  });

  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } });

  return { ...counts, deletedTags: deletedTags.count };
}
