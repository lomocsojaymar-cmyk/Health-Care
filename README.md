# Community Health Appointment System (CHAS)

A scheduling platform for community health centers that lets patients book, reschedule, and track appointments while giving front-desk staff and clinicians a fast, reliable view of their day. Designed for walk-in clinics, community centers, and small multi-provider practices — including users with low digital literacy and older adults.

## Design Goals

1. **Efficiency** — booking an appointment takes ≤ 60 seconds; staff can resolve any caller's status in ≤ 3 clicks.
2. **Accessibility** — WCAG 2.1 AA minimum; large tap targets; no color-only status cues.
3. **Full CRUD** — every core entity (Patients, Appointments, Providers) supports Create, Read, Update, Delete with audit trails.
4. **Correct scheduling** — double-booking is impossible at the database level, not just in UI code.
5. **Privacy-aware** — medical data is treated as sensitive everywhere (transport, storage, logging, exports).

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/01-tech-stack.md](docs/01-tech-stack.md) | Frontend, styling, backend, database, version control & deployment |
| [docs/02-data-model-and-crud.md](docs/02-data-model-and-crud.md) | ERD, table schemas, CRUD matrices per entity, scheduling business rules |
| [docs/03-ui-ux-design-system.md](docs/03-ui-ux-design-system.md) | Color palette, typography, layout blueprints, components, accessibility |
| [docs/04-implementation-plan.md](docs/04-implementation-plan.md) | Phase-by-phase build plan with exit criteria and milestones |
| [AGENTS.md](AGENTS.md) | Skill agents aligned to the architecture — contracts and ownership for AI/human contributors |

## Quick Start (demo build implemented in this repo)

```bash
npm install
npm run seed       # demo providers, patients, appointments → data/chas.json
npm run dev        # http://localhost:3000
```

Sign in from the landing page as a demo patient, front-desk staff, or admin.
The demo build uses a file-backed JSON store with the same service seams as
the Postgres/Prisma design (see AGENTS.md → Data Steward agent).

## Full design documentation

## Roles

| Role | Capabilities |
| --- | --- |
| Patient | Register, book/cancel/reschedule own appointments, view own history |
| Front desk (Admin) | Manage patients, book on behalf of patients, manage providers, daily schedule views |
| Provider (Doctor) | View own schedule, update appointment status, manage availability |
| System Admin | User accounts, roles, audit logs, configuration |
