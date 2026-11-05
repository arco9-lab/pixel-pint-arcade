import { demoCovers } from "@/features/demo/covers";

export type CoverUploadMode = "form" | "blob";

export const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const COVER_IMAGE_CONTENT_TYPES = [
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const COVER_BLOB_PATH_PREFIX = "posts/";

const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const demoCoverUrls = new Set(demoCovers.map((cover) => cover.url));

export const isBlobUrl = (value: string) => {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
};

export const isDemoCoverUrl = (value: string) => demoCoverUrls.has(value);

export const isAllowedCoverImageUrl = (value: string) =>
  isBlobUrl(value) || isDemoCoverUrl(value);
