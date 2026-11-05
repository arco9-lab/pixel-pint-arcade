import "server-only";

import { cache } from "react";

import { prisma } from "@/db/prisma";
import { getCurrentSession } from "@/server/auth";

export const requireUser = cache(async () => {
  const session = await getCurrentSession();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session.user;
});

export const requireUserRecord = cache(async () => {
  const user = await requireUser();
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  });

  if (!userRecord) {
    throw new Error("Unauthorized");
  }

  return userRecord;
});

export const requireAdmin = cache(async () => {
  const user = await requireUserRecord();

  if (user.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return user;
});

export const requirePostAuthor = cache(async () => {
  const user = await requireUserRecord();

  if (user.role !== "ADMIN" && user.role !== "DEMO") {
    throw new Error("Forbidden");
  }

  return user;
});
