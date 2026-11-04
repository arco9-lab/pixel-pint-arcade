import { NextResponse } from "next/server";

import { deleteExpiredDemoUsers } from "@/features/demo/data/cleanup";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await deleteExpiredDemoUsers();

  return NextResponse.json(result);
}
