import { prisma } from "@/db/prisma";

export async function cleanupDatabase() {
  await prisma.comment.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.postBookmark.deleteMany();
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.user.deleteMany();
}
