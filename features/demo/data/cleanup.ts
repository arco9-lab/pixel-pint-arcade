import "server-only";

import { prisma } from "@/db/prisma";

export type DemoCleanupResult = {
  deletedUsers: number;
  deletedPosts: number;
  deletedTags: number;
};

export async function deleteExpiredDemoUsers(
  now: Date = new Date(),
): Promise<DemoCleanupResult> {
  const expiredUsers = await prisma.user.findMany({
    where: { role: "DEMO", demoExpiresAt: { lt: now } },
    select: { id: true },
  });
  const expiredUserIds = expiredUsers.map((user) => user.id);

  const [deletedPosts, deletedUsers] = await prisma.$transaction([
    prisma.post.deleteMany({ where: { authorId: { in: expiredUserIds } } }),
    prisma.user.deleteMany({ where: { id: { in: expiredUserIds } } }),
  ]);

  const deletedTags = await prisma.tag.deleteMany({
    where: { posts: { none: {} } },
  });

  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.verification.deleteMany({ where: { expiresAt: { lt: now } } });

  return {
    deletedUsers: deletedUsers.count,
    deletedPosts: deletedPosts.count,
    deletedTags: deletedTags.count,
  };
}
