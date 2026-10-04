# CHAS — Agent & Contributor Guide

Guidance for AI agents and human contributors working in this repository.
The system is a Next.js 15 app with a JSON-file data store, server actions for
all mutations, and a pure scheduling engine. Read `docs/02-data-model-and-crud.md`
for the domain rules before changing scheduling code.

## Skill agents

Each agent below owns a boundary of the codebase. Follow its contract when
working on its area; do not reach across boundaries except through the seams
noted in "Integration rules".

### 1. Data Steward agent — `src/lib/store.ts`, `src/lib/types.ts`, `scripts/seed.ts`

Owns persistence shapes and integrity.

- **Contract:** All writes go through `withDb()` (serialised, atomic tmp-file
  rename). Never mutate arrays returned by `readDb()` without `withDb`.
- **Invariants:** Patient/Provider deletion is *soft* (`status: INACTIVE`);
  every mutation appends an audit row via `appendAudit` inside the same
  transaction; `data/chas.json` is git-ignored runtime data — never commit it.
- **When asked to move to Postgres/Prisma:** keep the function signatures in
  `store.ts` stable; the rest of the app must not change.

### 2. Scheduling Logic agent — `src/lib/scheduling.ts`

Owns slot generation and booking rules. The most correctness-critical file.

- **Contract:** Pure functions only — no `fs`, no React, no imports from
  `app/`. Deterministic given a `Database` snapshot.
- **Invariants from docs/02:** weekly template − exceptions − bookings −
  buffer = open slots; a slot must be re-validated at write time (the UI list
  can be stale); cancellation cutoff 12h for patients; reschedule is a
  validate-then-move with rollback on failure; statuses are
  `SCHEDULED → COMPLETED | CANCELLED | NO_SHOW` with history rows.
- **Never** allow double-booking: `bookAppointment`/`rescheduleAppointment`
  must always consult `generateSlots`.

### 3. API Actions agent — `src/lib/actions.ts`, `src/lib/schemas.ts`, `src/lib/auth.ts`

Owns the mutation surface (server actions) and validation.

- **Contract for every action:** Zod-parse input → resolve actor via
  `getActor()`/`requireStaff()` → run inside `withDb` → `appendAudit` →
  `revalidatePath` → return `ActionResult<T>` (never throw raw errors to the
  client except through the `SchedulingError` catch).
- **Authorization:** patients may only touch their own appointments; only
  staff call `setAppointmentStatusAction`, provider CRUD, and patient
  deactivate. New actions must follow the same guard pattern.
- **Validation:** schemas live in `schemas.ts` and are shared with forms;
  never hand-roll field parsing inside a page.

### 4. Experience Design agent — `src/app/globals.css`, `src/components/`, layouts

Owns the design system and usability.

- **Tokens:** colors/typography come only from the CSS variables in
  `globals.css` (doc 03). No ad-hoc hex values in components.
- **Accessibility:** every actionable element ≥ 44px tall, focus-visible
  outline preserved, destructive actions behind `ConfirmDialog`, status shown
  with text + color (never color alone), plain language at ~6th-grade level.
- **Conventions:** forms use the `.field` markup with visible labels and
  inline errors; feedback uses `useToast`; server data flows through server
  components, client components only for interactivity.

### 5. Flows agent — `src/app/` pages

Owns user journeys: booking wizard, patient dashboard, staff console.

- **Contract:** pages are thin — resolve actor, read via `scheduling.ts`
  helpers, render; interactivity delegates to client components that call
  actions. Booking state must re-validate server-side on submit (a chosen
  slot can disappear).
- **Routing map:** `/book` (patient wizard, supports `?reschedule=`),
  `/my` (patient dashboard), `/staff` (day schedule), `/staff/schedule/new`
  (book on behalf), `/staff/patients` (+ `[patientId]`), `/staff/providers`
  (+ `[providerId]`), `/staff/audit`, `/api/slots`.
- **Empty/error states:** every list has an empty state; every action has an
  error toast with a recovery path; no silent failures.

### 6. Quality & Safety agent — tests, audits, review

Owns verification.

- **Before merge:** `npm run typecheck` and `npm run build` clean; walk the
  CRUD matrix in docs/02 and tick each cell; check no PHI in URLs/logs;
  destructive flows have confirmations.
- **Review lens:** scheduling changes need a DST/timezone argument; action
  changes need an authorization argument; UI changes need an a11y argument.

## Integration rules

- Boundaries talk through: `store.ts` (persistence), `scheduling.ts` (rules),
  `actions.ts` (mutation API), `globals.css` (presentation tokens).
- Domain types come only from `src/lib/types.ts`.
- Seed data (`npm run seed`) is the only source of demo records; don't embed
  demo fixtures in components.

## Build & commands

```bash
npm install
npm run seed        # regenerate data/chas.json demo dataset
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run reset-data  # empty the store
```
