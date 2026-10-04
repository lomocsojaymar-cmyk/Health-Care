# 2 · Data Model & CRUD Implementation

## Entity-Relationship Overview

```
Patient 1──* Appointment *──1 Provider *──1 AvailabilityTemplate
                                   │
                                   └──* ScheduleException (time off)
User 1──1 Patient | Provider | Admin (role)      AppointmentStatusHistory *──1 Appointment
AuditLog (who did what, when)                    Notification (email log)
```

## Schemas (Postgres via Prisma)

### patients

| Column | Type | Notes |
| --- | --- | --- |
| id | `uuid PK` | |
| first_name / last_name | `text NOT NULL` | |
| date_of_birth | `date NOT NULL` | Used to disambiguate duplicate registrations |
| phone | `text` | Primary contact channel in community settings |
| email | `text UNIQUE` | Login identifier if self-service |
| address_line, city, postcode | `text` | |
| emergency_contact | `jsonb` | `{name, phone, relationship}` |
| medical_notes | `text` | Free text; visible to staff only |
| status | `enum('ACTIVE','INACTIVE')` | Soft delete — see below |
| created_at / updated_at | `timestamptz` | |

### providers

| Column | Type | Notes |
| --- | --- | --- |
| id | `uuid PK` | |
| full_name, credentials | `text` | e.g. "Dr. A. Okafor, MD" |
| specialty | `text` | |
| email / phone | `text UNIQUE` | |
| slot_minutes | `int DEFAULT 30` | Default appointment length |
| buffer_minutes | `int DEFAULT 0` | Breathing room between visits |
| status | `enum('ACTIVE','INACTIVE')` | Soft delete |
| created_at / updated_at | `timestamptz` | |

### availability_templates — recurring weekly hours

| Column | Type | Notes |
| --- | --- | --- |
| id | `uuid PK` | |
| provider_id | `uuid FK → providers` | |
| weekday | `int 0–6` | 0 = Sunday |
| start_time / end_time | `time` | Local clinic time, e.g. 09:00–17:00 |
| UNIQUE(provider_id, weekday, start_time) | | |

### schedule_exceptions — holidays, leave, one-off changes

| Column | Type | Notes |
| --- | --- | --- |
| id | `uuid PK` | |
| provider_id | `uuid FK` | |
| date | `date` | |
| is_day_off | `boolean` | |
| new_start / new_end | `time NULL` | Partial-day override |
| reason | `text` | |

### appointments

| Column | Type | Notes |
| --- | --- | --- |
| id | `uuid PK` | |
| patient_id | `uuid FK → patients` | |
| provider_id | `uuid FK → providers` | |
| starts_at / ends_at | `timestamptz NOT NULL` | Absolute UTC instants |
| status | `enum('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')` | |
| booked_by | `enum('PATIENT','STAFF')` | |
| reason / notes | `text` | reason = patient-facing; notes = staff-only |
| created_at / updated_at | `timestamptz` | |

Plus the `no_double_booking` GiST exclusion constraint from doc 01, and `AppointmentStatusHistory (appointment_id, old_status, new_status, changed_by, at)`.

### users & audit_log

- `users (id, email UNIQUE, password_hash, role enum('PATIENT','STAFF','ADMIN','PROVIDER'), patient_id?, provider_id?)` — one login can map to a patient or provider profile.
- `audit_log (id, actor_user_id, action, entity, entity_id, diff jsonb, at)` — written in the same transaction as every mutation.

## Soft-delete policy

Nothing that appears in a medical record is ever hard-deleted:

- **Patients** — `status → INACTIVE`; hidden from default lists and booking search; history preserved for clinical/retention requirements.
- **Providers** — `status → INACTIVE`; blocked from new bookings; historical appointments kept and shown on reports.
- **Appointments** — a patient-facing "cancel" sets `status = CANCELLED` (frees the slot). Hard `DELETE` is restricted to admin data-cleanup scripts (e.g. duplicate test records) and is audit-logged.

## CRUD matrix

Legend: ✅ supported · 🚫 not exposed · 🔒 role-restricted

| Entity | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| Patient | ✅ self-registration + 🔒 staff intake form | ✅ own profile/history; 🔒 staff: directory, search, chart | ✅ self (contact info); 🔒 staff (all fields) | ✅ soft-delete (deactivate) 🔒 staff |
| Appointment | ✅ patient self-book (staff can book on behalf) | ✅ own list; 🔒 staff/provider: day & week views, filters | ✅ reschedule, ✅ status → COMPLETED/NO_SHOW/CANCELLED 🔒 staff/provider | ✅ cancel (status change, not row deletion) |
| Provider | 🔒 admin/staff adds staff | ✅ directory + availability calendar | ✅ working hours, exceptions, slot/buffer minutes 🔒 admin | ✅ soft-delete (deactivate) 🔒 admin |
| Availability | 🔒 admin edits templates/exceptions | ✅ rendered as bookable slots & provider calendar | 🔒 admin adjusts hours | ✅ delete/expire template rows |

## Business rules (service layer, transaction-enforced)

1. **Slot generation**: `availability_templates` for the weekday − `schedule_exceptions` − existing `SCHEDULED` appointments − buffer = open slots on the `slot_minutes` grid.
2. **Overlap prevention**: enforced by the DB exclusion constraint; the service layer still pre-checks to return a friendly error before hitting the constraint.
3. **Booking window**: patients may book from "now + 1 hour" out to 90 days; staff may override.
4. **Cancellation policy**: patients can cancel/reschedule up to 12 hours before start (configurable); after that they see "call the front desk."
5. **No-show tracking**: staff flag NO_SHOW; 3 in a rolling year prompts a note to staff (no automatic blocking in v1).
6. **Reschedule = transactional move**: update `starts_at/ends_at` and run the overlap check inside one transaction; status history records the change.
7. **Every mutation writes an audit row**; patient-facing messages never leak whether a time slot was taken by someone else beyond "that time is no longer available."

## API surface (Server Actions, grouped)

```
patients.create / patients.update / patients.deactivate / patients.search
appointments.book / appointments.reschedule / appointments.cancel
appointments.setStatus (COMPLETED | NO_SHOW) / appointments.listFor* (patient|provider|day)
providers.create / providers.updateHours / providers.addException / providers.deactivate
availability.generate(providerId, dateRange) → slot list
```

Each action follows the same skeleton:

```ts
const data = schema.parse(input);          // 1. validate
await requireRole('STAFF');                // 2. authorize
const result = await prisma.$transaction(async tx => {
  const row = await tx.appointment.update({ ... });   // 3. mutate
  await writeAudit(tx, actor, 'APPOINTMENT_RESCHEDULED', row.id, diff);
  return row;
});                                        // 4. audit in same tx
revalidatePath('/staff/schedule');         // 5. refresh affected views
return { ok: true, data: result };
```
