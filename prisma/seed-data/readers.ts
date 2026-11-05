import type { SeedReader } from "./types";

export const SEED_ADMIN_ALIAS = "admin";

export const seedReaders: SeedReader[] = [
  { alias: "otto", id: "seed-reader-otto", name: "Otto", email: "otto@demo.invalid" },
  { alias: "june", id: "seed-reader-june", name: "June", email: "june@demo.invalid" },
  { alias: "sam", id: "seed-reader-sam", name: "Sam", email: "sam@demo.invalid" },
  { alias: "mira", id: "seed-reader-mira", name: "Mira", email: "mira@demo.invalid" },
];
