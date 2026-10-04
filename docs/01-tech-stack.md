# 1 · Recommended Tech Stack

Chosen for: fast rendering, one language across the stack (TypeScript), a database that treats time as a first-class citizen, and a styling system a small team can keep consistent. Alternatives are noted where a common choice loses.

## Stack at a Glance

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router)** | Server components + server actions eliminate most API boilerplate; streaming SSR keeps first paint fast; one repo for UI and API |
| Language | **TypeScript** (strict) | Scheduling logic is full of edge cases; types catch them at compile time |
| Styling / UI | **Tailwind CSS v4 + shadcn/ui** | Utility classes keep styles local; shadcn gives accessible, themeable primitives you own in-repo |
| Forms & validation | **React Hook Form + Zod** | Shared validation schemas between client and server |
| Backend | **Next.js Route Handlers + Server Actions** | Scheduling mutations run transactionally server-side; no separate API server to deploy for an MVP |
| Database | **PostgreSQL 16 + Prisma ORM** | Best-in-class `DATE`/`TIMESTAMPTZ`/`INTERVAL` handling, exclusion constraints prevent double-booking at the DB level |
| Auth | **Auth.js (NextAuth v5)** | Email + password with roles; OAuth optional |
| State | **Server state via RSC; TanStack Query only where interactive** | Most pages need fresh server data, not a client cache |
| Charts / calendar | **FullCalendar (React)** | Proven week/day schedule views for the provider dashboard |
| Email / reminders | **Resend + React Email** | Confirmation and 24h reminder emails with templates in-repo |
| Testing | **Vitest + React Testing Library + Playwright** | Unit, component, and end-to-end booking-flow tests |
| Version control | **Git + GitHub, trunk-based flow** | See workflow below |
| Deployment | **Vercel (app) + Neon or Supabase (Postgres)** | Zero-config preview deploys per PR; managed Postgres with branching for test databases |

### Rejected alternatives (and why)

- **MongoDB** — appointment availability is a range-overlap query problem; relational `tstzrange` + exclusion constraints solve it declaratively. MongoDB needs application-level locking.
- **Firebase/Supabase-only backend** — great for prototypes, but scheduling rules (working hours, buffers, no-show limits) need a trusted transactional layer; enforcing them in client-accessible rules is fragile.
- **Material UI / Bootstrap** — heavier bundles and a "generic admin" look; shadcn + Tailwind hits the warm healthcare aesthetic with less override work.
- **Redux** — unnecessary when server components own most data fetching.

## Frontend detail

- Next.js App Router with route groups: `(patient)`, `(staff)`, `(auth)`.
- React Server Components for dashboards and schedule reads (fast first paint, no client fetch waterfall); client components only for the booking wizard, filters, and modals.
- Streaming with `loading.tsx` skeletons so slow queries never blank the page.
- Responsive breakpoints: mobile-first; booking wizard is a single column on phones, two-column on desktop. The staff daily schedule is a table on desktop and stacked cards under `lg`.

## Backend detail

- **Server Actions** for all mutations (create patient, book, reschedule, cancel, update status). Each action: `zod` parse → role check → `prisma.$transaction` → revalidate path → return typed result.
- **Route Handlers** (`/api/*`) only where a raw API is needed: webhook receivers (email events), future mobile app, exports.
- A thin **service layer** (`src/server/services/*.ts`) holds scheduling rules so UI, actions, and tests share one implementation:
  - `availability.ts` — generates open slots from provider working hours minus bookings, breaks, buffers.
  - `booking.ts` — books/reschedules/cancels inside a transaction with overlap checks.
  - `policies.ts` — cancellation cutoffs, no-show limits, reschedule windows.
- Audit logging via a `writeAudit()` helper called inside the same transaction as every mutation.

## Database detail (why Postgres wins for scheduling)

- `TIMESTAMPTZ` everywhere; store clinic timezone in config and render in it.
- Range types: `tstzrange` for appointment periods with a **GiST exclusion constraint** that makes overlapping bookings for the same provider physically impossible:

```sql
ALTER TABLE appointments ADD CONSTRAINT no_double_booking
EXCLUDE USING gist (
  provider_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

- Partial indexes on hot queries: `(provider_id, starts_at) WHERE status = 'SCHEDULED'`, `(patient_id, starts_at DESC)` for history.
- Prisma for typed queries and migrations; raw SQL for the exclusion constraint and reporting views.

## Version control & Git workflow

- **Trunk-based**: `main` is always deployable. Short-lived feature branches (`feat/booking-wizard`), squash-merged via PR.
- Conventional Commits (`feat:`, `fix:`, `chore:`) power automatic changelogs and semantic version bumps.
- PR checklist: tests pass, `tsc --noEmit` clean, migration reviewed, screenshots for UI changes, no PHI in fixtures or logs.
- Branch protection on `main`: required CI (lint, typecheck, unit + e2e), 1 approving review, linear history.
- Every PR gets a Vercel preview URL for design review before merge.
- `.env` files git-ignored; secrets live in Vercel/CI environment settings only.

## Deployment & operations

| Concern | Practice |
| --- | --- |
| Hosting | Vercel app + Neon Postgres (serverless driver, pooled connections) |
| Environments | `main` → production; PR previews; a `staging` branch pointing at a Neon branch DB with synthetic data only |
| Migrations | `prisma migrate deploy` as a release step; migrations are forward-only and reviewed for lock impact |
| Backups | Managed PITR backups (Neon); quarterly restore drill |
| Monitoring | Vercel Analytics + Sentry (source maps uploaded, PII scrubbing on) |
| Reminders | Cron job (Vercel Cron) hourly: enqueue 24h reminder emails, auto-flag past appointments for status reconciliation |
| Compliance posture | TLS everywhere, PHI never in URLs or logs, signed `HttpOnly` `Secure` session cookies, RBAC checks in the service layer, retention policy doc |
