# Pixel Pint Arcade

A retro gaming blog with a pixel-art interface, searchable articles, reader interactions, and an Admin publishing workflow. Built with Next.js, TypeScript, and PostgreSQL.

**[Live demo](https://pixel-pint-arcade.vercel.app/)**

![Pixel Pint Arcade demo: desktop, mobile, and demo editor](docs/media/demo.gif)

## Features

- **Blog:** article pages, related posts, table of contents, and social sharing.
- **Discovery:** search and tag filtering.
- **Authentication:** email/password sign-up and sign-in with Better Auth; optional Google OAuth.
- **Comments:** threaded discussions and per-article comment controls.
- **Likes and bookmarks:** signed-in reader interactions and saved articles.
- **Admin editor:** create, edit, delete, save drafts, publish articles, manage tags, and set cover images and SEO metadata.
- **Demo sandbox:** temporary visitor accounts with a limited, private publishing workspace.

**Publishing permissions:** in normal use, only users with the `ADMIN` role can create articles; registering an account does not grant publishing access. The demo has an explicit exception: `DEMO` users can try the editor with up to three posts visible only to their author, even when marked published. They cannot change Admin articles or upload cover images.

## Stack and project structure

Next.js 16 (App Router), React 19, TypeScript, CSS Modules and Tailwind CSS 4, PostgreSQL, Prisma 7, Better Auth, and Zod. Tests use Vitest, React Testing Library, and Playwright. The demo deployment uses Vercel, Neon, and Vercel Blob.

```text
app/         Routes, layouts, pages, and API handlers
features/    Blog, auth, comments, demo, and other feature modules
server/      Authentication, permission checks, and image storage
prisma/      Database schema, migrations, and seed data
tests/      Shared test setup, integration helpers, and E2E suites
```

Unit, component, and integration tests also live alongside the code they exercise. Shared UI is in `components/`; database access is configured in `db/`.

## Quick start with Docker

Requires Docker Engine with Docker Compose v2.

```bash
git clone https://github.com/arco9-lab/pixel-pint-arcade.git
cd pixel-pint-arcade
cp .env.example .env
```

Before starting, edit `.env`:

- Set `DATABASE_URL` to `postgresql://pixel_pint:pixel_pint_dev_password@localhost:5435/pixel_pint_arcade?schema=public` for commands run on the host.
- Remove `DATABASE_URL_UNPOOLED` unless you have a separate direct database URL. Its example value is a placeholder and takes precedence for Prisma CLI commands and the seed.
- Leave `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` empty unless configuring Google OAuth. The example strings are placeholders, not working credentials.
- Set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` if you want to seed sample content and an Admin account.

```bash
docker compose up --build
```

Open [localhost:3000](http://localhost:3000). The app waits for PostgreSQL, generates the Prisma client, applies migrations, and starts `next dev`. Seeding is a separate, optional step:

```bash
docker compose exec app npm run db:seed
```

**The supplied Compose stack is a development setup.** It uses source mounts, development credentials, and the Next.js development server. It is not a production deployment configuration.

The app container receives its own `DATABASE_URL` (`db:5432`) and local auth settings from Compose. PostgreSQL is exposed to the host on port **5435** by default. `APP_PORT` and `APP_DATABASE_PORT` can override the published ports; adjust host URLs accordingly. Leave `DATABASE_URL_UNPOOLED` unset for this setup so container commands use the Compose database URL.

```bash
docker compose logs -f app db
docker compose down
```

Database data persists in a named volume. Local uploads persist under `public/uploads/`.

## Local development without Docker

Requires **Node.js 22.x**, npm, and a running **PostgreSQL** database (the Compose stack uses PostgreSQL 17). Create an empty database and a user with permission to apply migrations.

```bash
cp .env.example .env
```

Configure `.env` with your database connection and auth settings, for example:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/pixel_pint_arcade?schema=public"
BETTER_AUTH_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
DEMO_MODE="false"
ADMIN_EMAIL="admin@example.com"
ADMIN_NAME="Admin"
ADMIN_PASSWORD="replace-with-a-strong-password"
```

Remove the placeholder `DATABASE_URL_UNPOOLED` or set it to a real direct connection string. Generate an auth secret with `openssl rand -base64 32`. Keep local env files out of version control.

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm ci` already generates the Prisma client through `postinstall`; the explicit generation command is useful after schema changes. The seed creates or updates the Admin account and adds sample articles, readers, comments, and engagement data. It is optional if you want an empty database.

Open [localhost:3000](http://localhost:3000). Sign in with the seeded Admin credentials and open `/admin/posts` to manage articles. For a new schema migration during development, use `npx prisma migrate dev --name <change-name>`.

Google OAuth is optional: email/password authentication works without it. To enable Google, set both credentials and register `<BETTER_AUTH_URL>/api/auth/callback/google` as the redirect URI with your OAuth provider.

## Environment variables

Use [.env.example](.env.example) as a checklist, replacing or removing its placeholder values. Prisma CLI commands and the seed prefer `DATABASE_URL_UNPOOLED` when it is present; the running app uses `DATABASE_URL`.

| Variable | Required | Purpose / example |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Runtime PostgreSQL connection string; use a pooled URL when your hosting setup provides one. Compose overrides it inside the app container. |
| `DATABASE_URL_UNPOOLED` | Only when a separate direct URL is needed | Direct connection for migrations and seed. Otherwise omit it entirely. |
| `BETTER_AUTH_SECRET` | Yes | Random auth secret, at least 32 characters. Compose supplies a development value. |
| `BETTER_AUTH_URL` | Yes for a configured deployment | App origin, e.g. `http://localhost:3000`; code defaults to that local URL. Compose supplies its local origin. |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID; leave empty to disable Google sign-in. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth secret; both Google credentials must be configured together. |
| `ADMIN_EMAIL` | Seed only | Email of the Admin created or updated by the seed. |
| `ADMIN_NAME` | Seed only | Display name of that Admin. |
| `ADMIN_PASSWORD` | Seed only | Password set by the seed, including on subsequent seed runs. |
| `DEMO_MODE` | Optional | `true` enables demo entry and disables email/password registration; defaults to off. |
| `CRON_SECRET` | Demo cleanup | Bearer token required by `/api/cron/demo-cleanup`. |
| `BLOB_READ_WRITE_TOKEN` | Optional locally; needed for Vercel uploads | Enables Vercel Blob cover uploads. Without it, Admin uploads use the local filesystem. |
| `APP_PORT` | Optional, Compose | Published app port; default `3000`. |
| `APP_DATABASE_PORT` | Optional, Compose | Published PostgreSQL port; default `5435`. |
| `DATABASE_TEST_URL` | Integration / E2E tests | Dedicated test database URL; its database name must include `_test`. |
| `POSTGRES_TEST_USER` | Test Compose | Test database username from `.env.test`. |
| `POSTGRES_TEST_PASSWORD` | Test Compose | Test database password from `.env.test`. |
| `POSTGRES_TEST_DB` | Test Compose | Test database name, e.g. `pixel_pint_test`. |
| `POSTGRES_TEST_PORT` | Test Compose | Published test database port; example uses `5434`. |

The legacy `DATABASE`, `DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_PORT` entries in `.env.example` are not consumed by the current app or Compose configuration; use the connection URL and Compose variables above.

## Tests and checks

After installing dependencies:

```bash
npm run lint
npm run typecheck
npm test
npm run test:component
```

Unit and component suites do not require a running database. Integration and E2E suites require a **dedicated test database** and delete test data during execution. Do not point them at a development or production database.

```bash
cp .env.test.example .env.test
npm run test:db:up
npm run test:db:migrate
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

The test Compose stack uses `.env.test`, PostgreSQL on port `5434`, and a database named `pixel_pint_test` by default. Keep its `POSTGRES_TEST_*` values and `DATABASE_TEST_URL` in sync. Wait for PostgreSQL to become ready before running migrations. Ensure `DEMO_MODE` is unset or `false` for these suites and avoid exported env values that override `.env.test`.

E2E builds the app and starts a production test server at `http://127.0.0.1:3100`. Keep that port available. On Linux CI, use `npx playwright install --with-deps chromium` when browser system dependencies are needed.

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run test:watch` | Watch unit tests. |
| `npm run test:component:watch` | Watch component tests. |
| `npm run test:integration:watch` | Watch integration tests with the test DB running. |
| `npm run test:e2e:headed` | Run E2E with a visible browser. |
| `npm run test:db:down` | Stop the test DB and **delete its volume**. |

[GitHub Actions](.github/workflows/ci.yml) runs lint, type checking, unit, component, integration, and E2E checks.

## Production deployment

### Vercel and Neon

The demo uses Vercel for the app, Neon for PostgreSQL, and Vercel Blob for Admin cover uploads. The repository's [vercel.json](vercel.json) selects Frankfurt (`fra1`), sets the build command, and schedules demo cleanup daily at `03:00 UTC`.

1. Create a Neon database and import the repository into Vercel.
2. Set `DATABASE_URL` to the pooled connection string and `DATABASE_URL_UNPOOLED` to the direct connection string. Check the actual variable names if using a storage integration.
3. Set a strong `BETTER_AUTH_SECRET` and set `BETTER_AUTH_URL` to the deployment's public origin.
4. Connect a Vercel Blob store and configure `BLOB_READ_WRITE_TOKEN` for Admin uploads.
5. For the public demo, set `DEMO_MODE=true` and `CRON_SECRET`. For normal registration, leave demo mode off. Google credentials remain optional.
6. Deploy. `npm run build:vercel` applies migrations only when `VERCEL_ENV=production`, then builds Next.js. Preview builds do not apply migrations.
7. After migrations are applied, create the Admin and sample content using the seed instructions below. In demo mode, verify the cleanup cron in Vercel.

Preview sign-in requires an auth origin matching that preview; a production `BETTER_AUTH_URL` does not configure preview authentication. Use a separate preview database when isolation is needed.

### Create an Admin

The seed requires `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`; these values are not needed by the running app. For a remote database, put the direct connection URL and Admin values in a private, git-ignored `.env.neon` file, then run locally after installing dependencies:

```bash
# .env.neon must contain trusted shell-compatible KEY="value" assignments.
set -a
source .env.neon
set +a
npx prisma migrate deploy
npm run db:seed
```

This seed also loads sample content; it is not an Admin-only provisioning command. Rerunning it updates the matching Admin's name, role, and password. Review the seed before using it against an existing content database.

### Self-hosting and uploads

For a Node.js deployment, supply the production environment variables and run:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start
```

Use a process manager or hosting service and a public HTTPS origin matching `BETTER_AUTH_URL`. The ordinary `npm run build` command does not apply migrations.

Without a Blob token, Admin cover images are written to `public/uploads/posts/`. A self-hosted deployment must preserve that directory across releases and serve `/uploads/posts/*`. Configure persistent storage and backups alongside database backups. On Vercel, use Blob rather than local filesystem uploads.

Supported covers are PNG, JPEG, WebP, and GIF, up to **5 MB**. Demo users choose from a built-in cover gallery instead of uploading files.

## Demo limitations

- Email/password registration is disabled in demo mode. “Enter as demo user” creates a separate temporary `DEMO` account.
- Each demo account can keep up to **three** posts, visible only to its author. Editing and deleting are limited to its own posts.
- Demo cover images come from the built-in gallery; custom uploads require an Admin.
- Accounts are marked to expire after **24 hours** and removed by the daily cleanup job, so cleanup normally happens around 24–48 hours after creation, depending on the scheduler. Treat demo data as temporary.
- Demo account creation is limited to **three accounts per IP per hour**. The deployed app relies on Vercel's forwarded client IP header.
- The demo uses free hosting tiers, so availability and response times can vary, including slower requests after database inactivity.

## Roadmap

Planned improvements, not implemented feature claims:

- Document a production self-hosting setup with persistent uploads and backups.
- Provide an Admin provisioning command that does not load sample content.

## License

Released under the [MIT License](LICENSE).
