# 4 · Step-by-Step Implementation Plan

Seven phases, each with concrete deliverables and an exit criterion. A solo dev with AI assistance can compress this to ~4–6 weeks; a two-person team, ~3 weeks.

## Phase 0 — Project scaffolding (½ day)

- `npx create-next-app@latest chas --typescript --tailwind --app --src-dir`
- Add: shadcn/ui (`npx shadcn@latest init`), Prisma, Auth.js, Vitest, Playwright, ESLint + Prettier, `husky` pre-commit (lint + typecheck).
- `docker-compose.yml` with Postgres 16 (+ pgcrypto) and MailHog for local email capture.
- GitHub repo: branch protection on `main`, CI workflow (lint → typecheck → unit tests → build), Vercel project connected, Neon database created.
- **Exit:** `npm run dev` shows the themed shell; CI is green on an empty PR; preview deploy works.

## Phase 1 — Database design & migrations (1–2 days)

1. Write `prisma/schema.prisma` for all entities from [doc 02](02-data-model-and-crud.md): patients, providers, availability_templates, schedule_exceptions, appointments, users, appointment_status_history, audit_log, notifications.
2. Create enums: `AppointmentStatus`, `PatientStatus`, `ProviderStatus`, `BookedBy`, `Role`.
3. `prisma migrate dev --init`, then add the raw-SQL migration for the `no_double_booking` GiST exclusion constraint and the partial indexes.
4. Write `prisma/seed.ts`: 4 providers with staggered hours, 20 patients, 2 weeks of appointments in mixed statuses, 1 admin + 1 staff user.
5. **Exit:** `prisma migrate reset && npm run seed` runs clean twice in a row; a manual `INSERT` of an overlapping appointment is rejected by the DB.

## Phase 2 — Auth, roles & service layer (2 days)

1. Auth.js credentials provider; `users` table linked to patient/provider profiles; middleware protecting `(staff)` route group by role.
2. Build `src/server/services/`: `availability.ts` (slot generation), `booking.ts` (book/reschedule/cancel/setStatus), `policies.ts` (windows, cutoffs), `audit.ts`.
3. Unit-test the services heavily — this is the correctness core of the product:
   - slot generation across DST transitions and clinic timezone;
   - overlap rejection, buffer respect, exception (time-off) subtraction;
   - cancellation cutoff enforcement; audit rows written on every mutation.
4. **Exit:** `vitest` coverage of services ≥ 90%; booking two overlapping slots in a test throws the friendly `SlotTakenError`.

## Phase 3 — API / Server Actions for full CRUD (2–3 days)

Implement the action groups from doc 02, each with the validate → authorize → transact → audit → revalidate skeleton:

| Order | Actions | Serves |
| --- | --- | --- |
| 1 | `patients.create/update/deactivate/search`, `patients.getProfile` | Patient + staff CRUD |
| 2 | `availability.generate` | Booking wizard + staff booking |
| 3 | `appointments.book/reschedule/cancel/setStatus`, `appointments.listFor*` | Appointment CRUD |
| 4 | `providers.create/updateHours/addException/deactivate` | Provider CRUD |
| 5 | Cron route: reminders + status reconciliation | Notifications |

- Validate everything with shared Zod schemas (`src/lib/schemas/`), reused by forms on the client.
- Add integration tests hitting each action as each role (patient can't call staff actions; staff can't read another clinic's data if multi-tenant later).
- **Exit:** every cell of the CRUD matrix in doc 02 is exercised by a passing test.

## Phase 4 — Frontend shell & patient flows (3–4 days)

1. Layout system: header with role-aware nav, footer with clinic info + support phone; theme tokens from doc 03 wired into Tailwind/shadcn CSS variables.
2. Auth pages: sign-in, register (patient self-Create), profile page (Read/Update, deactivate with confirm dialog).
3. **Booking wizard** (the flagship flow): reason grid → provider picker → week-strip date/time chips → confirm card → success screen with calendar file + email.
4. Patient dashboard: next-appointment hero, upcoming list, past visits, profile links — per the layout blueprint in doc 03.
5. Optimistic UI with `useOptimistic`/`useTransition` for cancel/reschedule; toasts with Undo.
- **Exit:** a new user can register → book → reschedule → cancel entirely on a phone-sized viewport; Lighthouse a11y ≥ 95 on all patient pages.

## Phase 5 — Staff & provider dashboards (3–4 days)

1. Day/week schedule view (FullCalendar) fed by `appointments.listFor*`; status colors + icons per doc 03.
2. Appointment detail drawer: check-in hints, Complete / No-show / Reschedule / Cancel actions with confirmations.
3. Staff patient directory: server-side search (name/DOB/phone), patient chart page (history + upcoming), intake form for phone bookings (staff Create on behalf).
4. Provider management: add/edit staff, weekly availability grid editor, exceptions calendar, deactivate.
5. Reports page v1: utilization by provider, no-show and cancellation rates, bookings-per-day (server-rendered tables; charts optional).
- **Exit:** staff can run a simulated clinic day — book walk-in, complete, no-show, reschedule — in under 3 clicks per action; every action lands in the audit log.

## Phase 6 — Notifications, polish & accessibility (2 days)

1. React Email templates: booking confirmation, 24h reminder, cancellation, reschedule; Resend integration + MailHog locally.
2. Vercel Cron: hourly reminder sweep; flag appointments in the past that are still `SCHEDULED` for staff reconciliation.
3. A11y & UX pass: keyboard-only walkthrough of booking and staff flows, screen-reader pass (status chips announce), form error patterns, empty states, `prefers-reduced-motion`.
4. Performance pass: RSC-first, bundle budget (< 200KB gz on patient pages), image optimization, table pagination + server search.
- **Exit:** axe DevTools reports zero critical violations; Playwright booking e2e passes on a throttled "Slow 3G" profile.

## Phase 7 — Hardening, docs & launch (1–2 days)

1. E2E suite in Playwright: register → book → reschedule → staff completes → patient sees history (the whole CRUD loop).
2. Security review: rate-limit auth + booking actions, PHI never in URLs/logs, dependency audit, session config.
3. Ops: Sentry + Analytics on, backup restore drill, `staging` branch ↔ Neon branch DB with synthetic seed only.
4. Docs: admin guide (managing providers/hours), staff quick-reference (one-pager), patient-facing FAQ.
5. Launch: migrate deploy → seed real providers/hours → smoke test on production preview → DNS cutover.
- **Exit:** production deploy with rollback plan tested; on-call checklist written.

## Dependency graph & suggested order of PRs

```
P0 → P1 → P2 → P3 ─┬→ P4 (patient flows)
                    └→ P5 (staff flows) → P6 → P7
```

P4 and P5 can proceed in parallel once P3 lands — they share only the design system and action contracts.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Timezone/DST bugs in slot generation | Clinic-local working hours stored as `time`; convert to UTC instants at the edges; DST unit tests in P2 |
| Double-booking under concurrency | DB exclusion constraint is the backstop; service pre-check is only for friendly errors |
| Low-tech patient drop-off in wizard | 4 short steps, plain language, "call us" escape hatch on every screen; usability test with 5 older adults in P6 |
| PHI exposure | Audit-logged access, no PHI in logs/URLs, staff role checks in service layer, retention policy in P7 |
| Scope creep (billing, EHR, telehealth) | Explicitly out of scope for v1; schema leaves room (notes fields, jsonb) without commitments |
