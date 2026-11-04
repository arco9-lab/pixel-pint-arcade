# pixel-pint-arcade

## Docker local stack

Create a local env file first:

```bash
cp .env.example .env
```

For the Docker stack, the app container receives its own `DATABASE_URL` from
`docker-compose.yml`, so you do not need to point `.env` at the Docker database.
Keep `.env` for local Next.js/Prisma runs and optional auth settings like
Google OAuth.

Run the app and PostgreSQL together:

```bash
docker compose up --build
```

The app is available at:

```txt
http://localhost:3000
```

The PostgreSQL container is exposed to the host on port `5435` by default to
avoid conflicts with other local databases:

```txt
postgresql://pixel_pint:pixel_pint_dev_password@localhost:5435/pixel_pint_arcade?schema=public
```

Inside Docker, the app uses:

```txt
postgresql://pixel_pint:pixel_pint_dev_password@db:5432/pixel_pint_arcade?schema=public
```

On startup, the app container waits for the database, runs `prisma generate`,
applies migrations with `prisma migrate deploy`, and starts `next dev`.

Useful commands:

```bash
docker compose logs -f app db
docker compose down
```

## Demo deployment

The public demo runs on Vercel Hobby (app), Neon Free (PostgreSQL) and Vercel
Blob (admin cover images). All three have free plans. Vercel Hobby is for
non-commercial use only.

In demo mode registration is closed. Visitors enter with the "Enter as demo
user" button, which creates a separate `DEMO` account per visitor. Expired demo
accounts are deleted by a daily cron job (`/api/cron/demo-cleanup`), so an
account lives for 24 to 48 hours.

### Environment variables

Set these in Vercel for the Production environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `https://<project>.vercel.app` |
| `DEMO_MODE` | `true` |
| `CRON_SECRET` | random string, Vercel sends it as a bearer token to the cron route |
| `BLOB_READ_WRITE_TOKEN` | created automatically when a Blob store is connected |

The Neon integration in Vercel creates `DATABASE_URL` and
`DATABASE_URL_UNPOOLED` itself. Check the names after connecting it.

`ADMIN_EMAIL`, `ADMIN_NAME` and `ADMIN_PASSWORD` are only needed locally for the
seed. Do not set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: without them the
Google provider stays disabled.

### Setup

1. Create a Neon project in the AWS Frankfurt region and copy the pooled and
   direct connection strings.
2. Import the repository in Vercel, connect Neon (Storage, Neon) and create a
   Blob store linked to the project.
3. Set the environment variables above.
4. Put `DATABASE_URL_UNPOOLED` and `ADMIN_*` into `.env.neon` (ignored by git)
   and run the seed from your machine:

   ```bash
   set -a; source .env.neon; set +a; npm run db:seed
   ```

5. Deploy. Migrations are applied during the production build by
   `npm run build:vercel`. Preview builds do not touch the database.
6. In Vercel, Settings, Cron Jobs, check the job and run it once manually.

### Notes

- Sign in on preview deployments does not work because `BETTER_AUTH_URL` points
  to production.
- Hobby cron jobs run once a day with up to an hour of drift.
- The demo account limit per address relies on the `x-forwarded-for` header set
  by Vercel.
- The first request after five idle minutes is slower because Neon suspends the
  database.
