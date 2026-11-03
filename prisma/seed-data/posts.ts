import type { SeedPost } from "./types";

export const seedPosts: SeedPost[] = [
  {
    slug: "placeholder-published-post",
    title: "Placeholder published post",
    excerpt: "Replace this entry with a real seed post.",
    content: "## Placeholder\n\nReplace this entry with a real seed post.",
    tags: ["Dev notes"],
    coverImageUrl: null,
    coverImageAlt: null,
    seoTitle: null,
    seoDescription: null,
    published: true,
    commentsEnabled: true,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: null,
  },
  {
    slug: "placeholder-draft-post",
    title: "Placeholder draft post",
    excerpt: "Replace this entry with a real seed draft.",
    content: "## Placeholder draft\n\nReplace this entry with a real seed draft.",
    tags: ["Dev notes"],
    coverImageUrl: null,
    coverImageAlt: null,
    seoTitle: null,
    seoDescription: null,
    published: false,
    commentsEnabled: true,
    createdAt: "2026-06-10T10:00:00.000Z",
    updatedAt: null,
  },
];
