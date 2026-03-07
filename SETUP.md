# Certigen - Setup and Implementation Guide

Certigen is a certificate generation and verification platform built for Talentease. It allows administrators to manage workshops, upload certificate templates, and generate personalized certificates that are emailed to participants with embedded QR codes for verification.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Font Files](#font-files)
5. [Google OAuth Setup](#google-oauth-setup)
6. [Cloudflare R2 Storage (Production)](#cloudflare-r2-storage-production)
7. [Email (Resend)](#email-resend)
8. [Running the App](#running-the-app)
9. [First-Time Admin Setup](#first-time-admin-setup)
10. [Deploying to Vercel](#deploying-to-vercel)
11. [Architecture Overview](#architecture-overview)
12. [Project Structure](#project-structure)
13. [How Things Work](#how-things-work)

---

## Prerequisites

- Node.js 18+
- pnpm (package manager)
- PostgreSQL database (local or hosted, e.g. Neon, Supabase, Railway)
- Google Cloud Console project (for OAuth)
- Cloudflare R2 bucket (for production file storage)
- Resend account (for sending emails)

---

## Environment Setup

1. Clone the repository and install dependencies:

   ```
   pnpm install
   ```

2. Copy the example environment file:

   ```
   cp .env.example .env
   ```

3. Fill in all values in `.env`. See sections below for details on each service.

### Environment Variables Reference

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Random secret for session signing. Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The base URL of the app (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ADMIN_USER_IDS` | Comma-separated Better Auth user IDs that should have admin access |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 access key (production only) |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 secret key (production only) |
| `S3_BUCKET` | R2 bucket name (default: `certigen`) |
| `CF_ACCOUNT_ID` | Cloudflare account ID (used to build the R2 endpoint) |
| `S3_REGION` | S3 region (use `auto` for R2) |
| `RESEND_API_KEY` | Resend API key for sending emails |
| `EMAIL_FROM` | Sender email address |
| `BASE_URL` | Public URL of the app (used in QR codes and email links) |

---

## Database Setup

The app uses PostgreSQL with Drizzle ORM. The schema includes 7 tables:

- 4 tables managed by Better Auth: `user`, `session`, `account`, `verification`
- 3 application tables: `workshops`, `templates`, `certificates`

To push the schema to your database:

```
pnpm db:push
```

This creates all tables. If you prefer generating SQL migration files first:

```
pnpm db:generate
pnpm db:migrate
```

To visually inspect your database:

```
pnpm db:studio
```

---

## Font Files

Certificate generation uses TTF font files for rendering text onto images. These files must be placed in the `fonts/` directory at the project root.

### Required font files:

| Font Family | File Name |
|---|---|
| Inter | `Inter-Regular.ttf` |
| Roboto | `Roboto-Regular.ttf` |
| Open Sans | `OpenSans-Regular.ttf` |
| Lato | `Lato-Regular.ttf` |
| Montserrat | `Montserrat-Regular.ttf` |
| Playfair Display | `PlayfairDisplay-Regular.ttf` |
| Merriweather | `Merriweather-Regular.ttf` |
| Great Vibes | `GreatVibes-Regular.ttf` |
| Dancing Script | `DancingScript-Regular.ttf` |
| Parisienne | `Parisienne-Regular.ttf` |
| Satisfy | `Satisfy-Regular.ttf` |
| Caveat | `Caveat-Regular.ttf` |

All fonts are available for free from Google Fonts. Download the TTF files and place them in `fonts/` with the exact filenames listed above.

If a font file is missing, the certificate generator will fall back to a basic SVG text rendering without the specific font styling.

---

## Google OAuth Setup

1. Go to the Google Cloud Console
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID (Web application)
5. Add the following authorized redirect URI:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
6. Copy the Client ID and Client Secret into your `.env` file

---

## Cloudflare R2 Storage (Production)

In development, files are stored locally in the `data/` directory. In production (`NODE_ENV=production`), files are stored in Cloudflare R2 (S3-compatible).

1. Create an R2 bucket in your Cloudflare dashboard
2. Generate an API token with R2 read/write permissions
3. Set the environment variables: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CF_ACCOUNT_ID`

The storage module automatically switches between local filesystem and R2 based on `NODE_ENV`.

---

## Email (Resend)

Certificate emails are sent via Resend.

1. Create a Resend account and verify your sending domain
2. Generate an API key
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in your environment

---

## Running the App

### Development

```
pnpm dev
```

The app runs at `http://localhost:3000`.

### Production Build

```
pnpm build
pnpm start
```

---

## First-Time Admin Setup

Admin access is controlled through a combination of Better Auth roles and environment-configured user IDs. On a fresh install, no users exist yet, so follow these steps:

1. Start the app and navigate to the home page
2. There is no public sign-up page. Admin sign-in happens via the `/admin` route, which redirects unauthenticated users to the home page
3. To sign in for the first time, navigate to the Better Auth sign-in flow (the admin nav triggers Google OAuth via Better Auth)
4. After signing in with Google for the first time, a user record is created in the `user` table
5. Find your user ID in the database (check the `user` table using Drizzle Studio or a database client)
6. Add your user ID to the `ADMIN_USER_IDS` environment variable (comma-separated if multiple admins)
7. Restart the app. You now have admin access at `/admin`

Once you are an admin, you can also use the Better Auth admin plugin to set other users' roles to "admin" without needing to add them to `ADMIN_USER_IDS`.

---

## Deploying to Vercel

1. Push your code to a Git repository
2. Import the project into Vercel
3. Set all environment variables in the Vercel dashboard
4. Make sure to set `BETTER_AUTH_URL` and `BASE_URL` to your production domain
5. The `next.config.ts` includes `outputFileTracingIncludes` to ensure font files are bundled into serverless functions. Commit your `fonts/` directory so Vercel can include them
6. `sharp` and `fontkit` are listed under `serverExternalPackages` so they are handled correctly in the serverless environment
7. Server Actions have a `bodySizeLimit` of 20MB to allow template image uploads

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + custom CSS classes |
| Database | PostgreSQL + Drizzle ORM |
| Authentication | Better Auth (Google OAuth, admin plugin) |
| File Storage | Cloudflare R2 (production) / Local filesystem (development) |
| Image Processing | sharp (compositing) + fontkit (font glyph rendering) + qrcode |
| Email | Resend |
| Deployment | Vercel |

### Data Flow

- **Public users** visit the home page, enter a workshop code, fill in their details, and receive a generated certificate via email. The certificate is a PNG image with their name, workshop details, and a QR code composited onto a template image.

- **Administrators** sign in via Google OAuth, then manage workshops, templates, and view issued certificates through the admin dashboard.

- **Certificate verification** is public. Anyone with a certificate ID (from the QR code or direct link) can verify its authenticity at `/verify/[id]`.

### Server-Side Patterns

- **Server Components** are used for all page-level data fetching. Pages fetch data directly using Drizzle queries, then pass the data to client components as props.
- **Server Actions** (in the `actions/` directory) handle all mutations: creating/updating/deleting workshops, templates, and generating certificates. Admin actions call `requireAdmin()` to verify authorization.
- **API Route Handlers** are used for binary responses (certificate download as a streamed PNG).
- **Middleware** runs on the Edge and checks for the existence of a session cookie on `/admin/*` routes as a fast pre-check. The actual authorization (admin role verification) happens in the admin layout server component.

### Authentication Flow

Authentication uses two layers of protection for admin routes:

1. **Edge Middleware** (`middleware.ts`): Checks if a session cookie exists. Redirects to home if no cookie is found. This is a lightweight pre-check that runs before any server component code.

2. **Admin Layout** (`app/admin/layout.tsx`): Calls `requireAdmin()` which validates the session with Better Auth and checks whether the user has the admin role or is listed in `ADMIN_USER_IDS`. Redirects to home if the check fails.

Server Actions additionally call `requireAdmin()` independently, so they are protected even if called outside the admin layout context.

### Storage Architecture

The storage module (`lib/storage.ts`) provides a unified interface for file operations. In production, it uses the AWS S3 SDK to interact with Cloudflare R2. In development, it writes to the local `data/` directory.

All storage keys are validated against path traversal attacks (rejecting keys with `..` or absolute paths). Content types are derived automatically from file extensions.

Files stored:
- Template images: `templates/{id}.{ext}`
- Generated certificates: `certificates/{workshopCode}/{certId}.png`

### Certificate Generation

Certificate images are generated server-side in `lib/certificate-gen.ts`:

1. The template image (uploaded by an admin) is loaded as the base layer
2. Text placeholders (name, date, workshop title, etc.) are rendered as SVG using fontkit to convert font glyphs into precise SVG paths. This ensures exact font rendering without relying on system-installed fonts.
3. A QR code linking to the verification URL is generated and placed in the bottom-right corner
4. All layers are composited together using sharp and exported as PNG
5. The resulting image is saved to storage and emailed to the participant

---

## Project Structure

```
certigen-next/
  actions/                    # Server Actions (mutations)
    certificate-actions.ts    # Generate certificates, lookup workshops
    template-actions.ts       # Template CRUD, preview
    workshop-actions.ts       # Workshop CRUD, stats

  app/                        # Next.js App Router pages
    layout.tsx                # Root layout (Inter font, metadata)
    page.tsx                  # Home page (workshop code entry)
    globals.css               # All styles (Tailwind + custom classes)
    admin/
      layout.tsx              # Admin auth guard + navigation wrapper
      page.tsx                # Dashboard (stats + recent certificates)
      templates/page.tsx      # Template management
      workshops/page.tsx      # Workshop management
    api/
      auth/[...all]/route.ts  # Better Auth catch-all handler
      certificates/[id]/
        download/route.ts     # Certificate PNG download (streaming)
    verify/[id]/page.tsx      # Public certificate verification
    workshop/[code]/page.tsx  # Public certificate generation form

  components/                 # React components (client and shared)
    admin-dashboard.tsx       # Stats cards + certificate table
    admin-nav.tsx             # Admin navigation bar with sign-out
    admin-templates.tsx       # Template CRUD UI + placeholder editor
    admin-workshops.tsx       # Workshop CRUD UI
    home-form.tsx             # Workshop code entry form
    workshop-form.tsx         # Certificate generation form + confirmation
    workshop-not-found.tsx    # Workshop not found state
    ui/
      dialog.tsx              # Radix UI dialog wrapper

  db/
    schema.ts                 # Drizzle schema (7 tables)

  fonts/                      # TTF font files (not in repo, must be added)

  lib/                        # Shared server utilities
    auth.ts                   # Better Auth server configuration
    auth-client.ts            # Better Auth browser client
    auth-utils.ts             # getSession() and requireAdmin() helpers
    certificate-gen.ts        # Image generation (sharp + fontkit + QR)
    db.ts                     # Drizzle client instance
    email.ts                  # Resend email service
    storage.ts                # S3/local file storage abstraction
    utils.ts                  # cn() helper (clsx + tailwind-merge)

  types/
    fontkit.d.ts              # Type declarations for fontkit module

  middleware.ts               # Edge middleware (session cookie check)
  next.config.ts              # Next.js config (external packages, fonts, body size)
  drizzle.config.ts           # Drizzle Kit config
```

---

## How Things Work

### Public Certificate Flow

1. User visits the home page and enters a workshop code
2. The app looks up the workshop and checks if it is active
3. User enters their name and email on the workshop page
4. A confirmation dialog shows the details before submission
5. The server action generates the certificate: loads the template, renders text via fontkit, adds QR code, composites with sharp
6. The certificate PNG is saved to storage, the database record is created, and the certificate is emailed to the participant
7. A success screen shows with a download link pointing to the API route handler, which streams the file directly from storage

### Admin Workflow

1. Admin signs in via Google OAuth through Better Auth
2. The admin dashboard shows stats (total workshops, certificates, templates) and a table of recently issued certificates
3. Templates page: upload a certificate template image, define text placeholders with position, font, size, color, and alignment. Preview the template with sample data.
4. Workshops page: create workshops with a unique code, title, date, and linked template. Toggle active/inactive status.
5. All mutations use Server Actions with `revalidatePath` to refresh the page data after changes

### Certificate Verification

1. Each certificate has a unique ID embedded in a QR code on the image
2. Scanning the QR code or visiting `/verify/[id]` shows the certificate details
3. The verification page uses `generateMetadata` to provide OpenGraph tags for social media previews
