"use server";

import { headers } from "next/headers";

import {
  createDemoAccount,
  hashClientIp,
} from "@/features/demo/data/demo-accounts";
import { isDemoMode } from "@/lib/demo-mode";

export type DemoSessionResult =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string };

const readClientIp = async () => {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  return (
    forwardedFor?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
};

export async function startDemoSessionAction(): Promise<DemoSessionResult> {
  if (!isDemoMode()) {
    return { ok: false, message: "Demo mode is not enabled." };
  }

  const result = await createDemoAccount({
    ipHash: hashClientIp(await readClientIp()),
  });

  if (!result.ok) {
    return {
      ok: false,
      message: "Too many demo accounts were created. Try again in an hour.",
    };
  }

  return { ok: true, email: result.email, password: result.password };
}
