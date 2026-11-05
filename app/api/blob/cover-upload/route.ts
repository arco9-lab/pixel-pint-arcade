import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import {
  COVER_BLOB_PATH_PREFIX,
  COVER_IMAGE_CONTENT_TYPES,
  COVER_IMAGE_MAX_BYTES,
} from "@/features/blog/cover-image";
import { requireAdmin } from "@/server/permissions";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await requireAdmin();

        if (!pathname.startsWith(COVER_BLOB_PATH_PREFIX)) {
          throw new Error("InvalidPath");
        }

        return {
          allowedContentTypes: COVER_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: COVER_IMAGE_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Could not prepare the cover upload." },
      { status: 400 },
    );
  }
}
