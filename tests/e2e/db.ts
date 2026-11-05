import { Pool } from "pg";
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });

if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}

if (!process.env.DATABASE_URL?.includes("_test")) {
  throw new Error("E2E tests must use a test database");
}

let activePool: Pool | undefined;

export function getPool() {
  activePool ??= new Pool({ connectionString: process.env.DATABASE_URL });
  return activePool;
}

export async function closeE2EDatabase() {
  const poolToClose = activePool;
  activePool = undefined;
  await poolToClose?.end();
}

export async function cleanupE2EDatabase() {
  const pool = getPool();
  await pool.query('DELETE FROM "Comment"');
  await pool.query('DELETE FROM "PostLike"');
  await pool.query('DELETE FROM "PostBookmark"');
  await pool.query('DELETE FROM "_PostToTag"');
  await pool.query('DELETE FROM "Post"');
  await pool.query('DELETE FROM "Tag"');
  await pool.query('DELETE FROM "session"');
  await pool.query('DELETE FROM "account"');
  await pool.query('DELETE FROM "verification"');
  await pool.query('DELETE FROM "rateLimit"');
  await pool.query('DELETE FROM "user"');
}

export async function findUserByEmail(email: string) {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    role: string;
  }>('SELECT "id", "name", "role" FROM "user" WHERE "email" = $1', [email]);
  return rows[0] ?? null;
}

export async function countSessionsForUser(userId: string) {
  const { rows } = await getPool().query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM "session" WHERE "userId" = $1',
    [userId],
  );
  return Number(rows[0].total);
}

type PublishedPostSeed = {
  id: string;
  title: string;
  slug: string;
  commentsEnabled: boolean;
  content?: string;
};

const defaultPostContent = ["Intro paragraph.", "", "## Heading", "Article body."].join(
  "\n",
);

export async function seedPublishedPost(post: PublishedPostSeed) {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO "user" ("id", "email", "name", "role", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT ("id") DO NOTHING
    `,
    ["e2e-admin", "e2e-admin@example.test", "E2E Admin", "ADMIN"],
  );

  await pool.query(
    `
      INSERT INTO "Post" (
        "id",
        "title",
        "slug",
        "excerpt",
        "content",
        "published",
        "commentsEnabled",
        "authorId",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW(), NOW())
    `,
    [
      post.id,
      post.title,
      post.slug,
      `A post for ${post.title} coverage.`,
      post.content ?? defaultPostContent,
      post.commentsEnabled,
      "e2e-admin",
    ],
  );
}

export async function seedPublishedPostForGuestFlow() {
  await seedPublishedPost({
    id: "e2e-guest-post",
    title: "Guest E2E Post",
    slug: "guest-e2e-post",
    commentsEnabled: true,
    content: [
      "Guest intro paragraph.",
      "",
      "## Guest Heading",
      "Guest article body.",
    ].join("\n"),
  });
}

export async function setPostCommentsEnabled(
  postId: string,
  commentsEnabled: boolean,
) {
  await getPool().query(
    'UPDATE "Post" SET "commentsEnabled" = $2 WHERE "id" = $1',
    [postId, commentsEnabled],
  );
}

export async function findCommentsForPost(postId: string) {
  const { rows } = await getPool().query<{ body: string; authorId: string }>(
    'SELECT "body", "authorId" FROM "Comment" WHERE "postId" = $1',
    [postId],
  );
  return rows;
}

export async function backdateCommentsForPost(
  postId: string,
  secondsAgo: number,
) {
  await getPool().query(
    `UPDATE "Comment" SET "createdAt" = NOW() - make_interval(secs => $2) WHERE "postId" = $1`,
    [postId, secondsAgo],
  );
}

export async function countPostLikes(postId: string) {
  const { rows } = await getPool().query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM "PostLike" WHERE "postId" = $1',
    [postId],
  );
  return Number(rows[0].total);
}

export async function countPostBookmarks(postId: string) {
  const { rows } = await getPool().query<{ total: string }>(
    'SELECT COUNT(*) AS total FROM "PostBookmark" WHERE "postId" = $1',
    [postId],
  );
  return Number(rows[0].total);
}
