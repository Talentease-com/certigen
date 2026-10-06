# Certigen

Certificate generation and verification platform for Talentease certificates.

## Setup

1. Install dependencies.

```bash
pnpm install
```

2. Create local environment configuration.

```bash
cp .env.example .env.local
```

3. Configure at least:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/certigen
BASE_URL=http://localhost:3000
APP_ORIGIN=http://localhost:3000
ADMIN_USER_IDS=
RESEND_API_KEY=
CERTIGEN_SERVICE_API_KEY=
```

`APP_ORIGIN` must exactly match the origin used in the browser, including protocol and port. Shoo
issues a different pairwise user ID for each origin. After signing in on a new origin, copy the
logged `ps_...` ID into the comma-separated `ADMIN_USER_IDS` value and restart Certigen. Changing
the origin requires registering the new ID.

4. Run the app.

```bash
pnpm dev
```

## Database Migrations

Schema changes live in `drizzle/` as numbered `.sql` files. Every server start
applies any that have not run yet, in order, before serving requests
(`src/instrumentation.ts`), so a deploy needs no manual migration step. Applied
files are recorded in the `certigen_migrations` table, and an advisory lock stops
two instances from migrating at once. Each file runs in its own transaction; a
failure rolls that file back, is logged, and leaves later files unapplied.

To run them yourself, for example before starting a new database, use:

```bash
pnpm db:migrate
```

Set `CERTIGEN_AUTO_MIGRATE=false` to turn off the automatic step. Builds never
touch the database. Databases migrated before tracking existed are recognised from
their schema on the first run, so earlier migrations are recorded, not re-run.

To add a migration, create the next numbered file in `drizzle/` and update
`src/db/schema.ts` to match.

## Production Database Migration

The migration commands default to reading `neon_clone` and creating
`nextjs_migrated` on the same PostgreSQL server as `DATABASE_URL`.
`neon_clone` is opened with PostgreSQL read-only mode enabled, and the migration
refuses to overwrite an existing target database.

```bash
pnpm db:migrate-production
pnpm db:compare-migrated
```

Override the database names with `MIGRATION_SOURCE_DATABASE` and
`MIGRATION_TARGET_DATABASE` when needed. After reconciliation passes, point the
deployed application's `DATABASE_URL` at the migrated database.

Template visuals are immutable after issuance. Each editor save creates a new
`template_versions` row and a version-specific background key; certificates
retain the exact version they were issued with. Migrated certificates prefer
their original stored PNG and fall back to their pinned initial version if that
file is unavailable.

## Elevate LMS Integration

Certigen exposes a server-to-server REST endpoint for Elevate LMS:

```http
POST /api/service/certificates
Authorization: Bearer <CERTIGEN_SERVICE_API_KEY>
Content-Type: application/json
```

The request references an existing Certigen template by exact `templateName`. The endpoint does not
create a workshop. It stores the Elevate course certificate with source metadata and uses the course
title/date in the existing `workshop_title` and `date` template placeholders.

Service certificate requests are idempotent by `source.platform + source.idempotencyKey`. Repeating
the same request returns the existing certificate; reusing the key with different certificate data
returns `409`.

Retrieve the original issued links without resending email or submitting mutable learner details:

```http
GET /api/service/certificates?platform=elevate-lms&idempotencyKey=<url-encoded-key>
Authorization: Bearer <CERTIGEN_SERVICE_API_KEY>
```

The response has the same `certId`, `verifyUrl`, `downloadUrl`, and `emailStatus` fields as issuance.
An unknown identity returns `404`.

Issuance now leaves `emailStatus=pending`; lookup never sends email. After Elevate stores the
artifact links, it requests delivery explicitly using the same immutable service identity:

```http
POST /api/service/certificates/delivery
Authorization: Bearer <CERTIGEN_SERVICE_API_KEY>
Content-Type: application/json

{"platform":"elevate-lms","idempotencyKey":"<original-key>"}
```

The endpoint returns the original links and email state. It claims one attempt at a time,
recovers an interrupted claim after two minutes, and uses the certificate ID as the email
provider idempotency key. A confirmed `sent` state never sends again. Failed sends remain on
the issued certificate for Elevate's bounded Payload job retries. Migration `0004` backs this
endpoint and is applied automatically on deploy (see Database Migrations).
