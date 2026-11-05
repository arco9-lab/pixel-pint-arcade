import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { cache } from "react";
import { headers } from "next/headers";

import { prisma } from "@/db/prisma";
import { isDemoMode } from "@/lib/demo-mode";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const hasGoogleCredentials =
  Boolean(googleClientId) &&
  Boolean(googleClientSecret) &&
  !googleClientId?.startsWith("replace-") &&
  !googleClientSecret?.startsWith("replace-");

const socialProviders =
  hasGoogleCredentials && googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : {};

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : [],
  secret: process.env.BETTER_AUTH_SECRET,
  onAPIError: {
    errorURL: "/auth/error",
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: isDemoMode(),
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  account: {
    accountLinking: {
      disableImplicitLinking: true,
    },
  },
  socialProviders,
  plugins: [nextCookies()],
});

export const getCurrentSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
  });
});
