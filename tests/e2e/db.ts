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

export async function seedPublishedPostForGuestFlow() {
  const pool = getPool();
  await pool.query(
    `
      INSERT INTO "user" ("id", "email", "name", "role", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, NOW(), NOW())
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
      VALUES ($1, $2, $3, $4, $5, true, true, $6, NOW(), NOW())
    `,
    [
      "e2e-guest-post",
      "Guest E2E Post",
      "guest-e2e-post",
      "A post for guest e2e coverage.",
      ["Guest intro paragraph.", "", "## Guest Heading", "Guest article body."].join(
        "\n",
      ),
      "e2e-admin",
    ],
  );
}
