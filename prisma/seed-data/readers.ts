import type { SeedReader } from "./types";

export const seedReaders: SeedReader[] = [
  { id: "seed-reader-1", name: "Mila Voss", email: "mila.voss@demo.invalid" },
  { id: "seed-reader-2", name: "Dex Harlow", email: "dex.harlow@demo.invalid" },
  { id: "seed-reader-3", name: "Nova Pike", email: "nova.pike@demo.invalid" },
  { id: "seed-reader-4", name: "Rook Elden", email: "rook.elden@demo.invalid" },
];

export const seedCommentBodies = [
  "Great read, this brought back a lot of memories.",
  "I never looked at it from this angle before. Thanks for sharing.",
  "Bookmarking this one for later.",
  "Curious what others think about the last section.",
];

export const seedReplyBodies = [
  "Agreed, that part stood out for me too.",
  "Same here, I had the exact same experience.",
];
