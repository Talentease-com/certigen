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

Apply `drizzle/0000_service_certificates.sql` before enabling the integration in an environment with
an existing database.
