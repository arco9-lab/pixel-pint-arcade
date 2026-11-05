import "server-only";

import { del } from "@vercel/blob";

import { isBlobUrl, type CoverUploadMode } from "@/features/blog/cover-image";

export const getCoverUploadMode = (): CoverUploadMode =>
  process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "form";

export const deleteCoverImageBlob = async (url: string | null | undefined) => {
  if (!url || !isBlobUrl(url) || !process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    await del(url);
  } catch (error) {
    console.error("Could not delete the cover image from Blob storage", error);
  }
};
