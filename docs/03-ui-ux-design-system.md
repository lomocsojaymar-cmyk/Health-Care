# 3 · UI/UX Design System

A calm, welcoming "community clinic" aesthetic: plenty of white space, rounded corners, high-contrast text, and forgiving interactions. Designed so a first-time user of any age can book without training, and front-desk staff can run their day from one screen.

## Color palette

Primary family is a calm medical teal-blue; greens signal success/status; amber and red are reserved for warnings and errors so they keep their meaning. All body text colors exceed WCAG AA (4.5:1) on white; large UI elements exceed 3:1.

| Role | Hex | Use |
| --- | --- | --- |
| Primary 700 | `#0F5E6B` | Buttons, links, active states (contrast 7.1:1 on white) |
| Primary 500 | `#17828F` | Hover, icon accents |
| Primary 100 | `#D8EEF1` | Selected slot background, active nav pill |
| Primary 50 | `#EFF7F8` | Section backgrounds, page canvas tint |
| Secondary 600 | `#2E7D32` | Confirmed status, success toast |
| Secondary 100 | `#E3F2E5` | "Upcoming" chips, positive KPIs |
| Accent 600 | `#F2A03D` | Highlights, empty-state illustrations only — never required-for-understanding info |
| Warning | `#B45309` | Late check-in, reschedule-needed |
| Danger | `#B3261E` | Cancel/no-show, destructive confirmations |
| Neutral 900 / 600 / 300 | `#1B2B2E` / `#5A6B6E` / `#C9D6D8` | Headings / body / borders |
| Surface | `#FFFFFF` | Cards, forms |

Rules: color is never the only signal — pair it with an icon and a text label. Buttons: primary teal filled, secondary outlined neutral, destructive red only with a confirmation dialog. Dark mode is out of scope for v1 (clinic screens, printable schedules).

## Typography

| Context | Font | Rationale |
| --- | --- | --- |
| UI + headings | **Inter** (400/500/600/700) | Tall x-height, unambiguous numerals for times (`0/O`, `1/l` distinct), tabular figures available |
| Dates & times | Inter `tabular-nums` | Columns of times align vertically in schedule tables |
| Long-form (printables, consent text) | **Source Serif 4** | Comfortable reading for take-home instructions |

Scale (rem): display 2.25 / h1 1.875 / h2 1.5 / h3 1.25 / body **1.0625 (17px)** / small 0.875 — minimum 16px for anything a patient types into. Line-height 1.5 for body, 1.2 for headings; sentence case everywhere (no all-caps labels except tiny table headers).

## Layout & spacing

- 4px base grid; card padding 24px desktop / 16px mobile; border-radius: 12px cards, 8px inputs, 999px pills.
- Elevation is minimal: 1px neutral-300 borders + a soft `0 1px 2px rgba(27,43,46,.08)`; focus ring is a 2px Primary 700 outline with 2px offset.
- Max content width 1200px; gutters 24px desktop / 16px mobile.
- Touch targets ≥ 44×44px (aging-friendly); time-slot chips render large on mobile with the full weekday and date spelled out ("Thursday, Oct 8 · 2:30 PM" — never "Thu 10/8").

## Patient dashboard — booking-first visual hierarchy

```
┌────────────────────────────────────────────────────────┐
│ CHAS logo     [Book appointment]      avatar ▾         │  ← sticky header, primary CTA always visible
├────────────────────────────────────────────────────────┤
│ 1 NEXT APPOINTMENT CARD (Primary 100 bg)               │  ← hero: provider photo/initials, date,
│    Thu Oct 8 · 2:30 PM · Dr. Okafor · Map / directions │     countdown, Add-to-calendar, Reschedule, Cancel
├────────────────────────────────────────────────────────┤
│ 2 BOOK NEW APPOINTMENT                                 │  ← giant button; on mobile this is the first row
├────────────────────────────────────────────────────────┤
│ 3 UPCOMING (list, max 3 + "View all")                  │  ← status chips: Confirmed/Reschedule needed
├────────────────────────────────────────────────────────┤
│ 4 PAST VISITS (collapsed by default) · VISIT SUMMARIES │  ← read-only history; "Request records" link
├────────────────────────────────────────────────────────┤
│ 5 PROFILE · CONTACT INFO (edit) · PREFERENCES          │  ← Update self-service CRUD
└────────────────────────────────────────────────────────┘
```

### Booking wizard (the 60-second flow)

One screen per step, visible progress indicator, back always safe:

1. **Reason for visit** — icon grid of common reasons (Check-up, Sick visit, Chronic care follow-up, Vaccination…).
2. **Provider** — "first available" default; filter by specialty, language, location.
3. **Date & time** — week strip of days with availability dots; large time chips; taken times are hidden, not greyed.
4. **Confirm** — plain-language summary card ("You'll see Dr. Okafor on Thursday, Oct 8 at 2:30 PM, 14 Main St."), insurance/contact fields if missing, then a full-width **Confirm** button.
5. **Confirmation** — success screen with calendar-file download, "Add another" and "View my appointments"; email sent simultaneously.

## Staff / provider dashboard — schedule-first hierarchy

```
┌──────────────────────────────────────────────────────────────────┐
│ CHAS · Today, Oct 8   [Day|Week]  Provider: All ▾   [+ New appt] │
├───────────────────────────────┬──────────────────────────────────┤
│ SCHEDULE GRID (FullCalendar)  │ RIGHT RAIL                       │
│  rows = providers / columns   │  · Waiting-room now (checked in) │
│  or time rows; color = status │  · Unconfirmed today (call list) │
│  click event → detail drawer  │  · New registrations (approve)   │
│  (patient card + actions:     │  · Alerts: no-show pattern,      │
│   Check in, Complete,         │    double-booked resources       │
│   No-show, Reschedule)        │                                  │
├───────────────────────────────┴──────────────────────────────────┤
│ TABS: Today · Patients (search) · Providers (availability CRUD)  │
│ · Reports (utilization, no-show rate, cancellations)             │
└──────────────────────────────────────────────────────────────────┘
```

- Status colors in the grid use palette + icon + label (teal dot = scheduled, green check = completed, grey slash = cancelled, amber ! = no-show) and survive greyscale printing.
- Detail drawer actions match the CRUD matrix: staff can book on behalf, reschedule (date-time picker with only valid slots enabled), set status, cancel; every write shows a brief confirmation toast and appears in the audit log.
- Provider availability editor: weekly grid of toggleable hour ranges per weekday + exception calendar for time off — direct manipulation, instant save.

## Components (shadcn/ui mapping)

| Component | Customization |
| --- | --- |
| Button | Primary teal, radius 8px, min-height 44px |
| Card | Radius 12px, neutral-300 border, soft shadow |
| Table | Row height 56px, zebra-free, sticky header, tabular-nums |
| Dialog | Focus trap, `role="alertdialog"` for destructive confirms |
| Toast | Bottom-right on desktop, top on mobile; 6s timeout; actions inline ("Undo" for cancel) |
| Empty states | Friendly illustration + one clear action ("No visits yet — Book your first appointment") |
| Form field | Label always visible (no placeholder-as-label), error text below with icon, `aria-describedby` wired |

## Accessibility & inclusion checklist

- WCAG 2.1 AA: contrast, visible focus, full keyboard operability, skip-to-content link.
- Screen reader semantics: status chips are text, tables have `<th>` scopes, live regions announce "Appointment confirmed."
- Error recovery: inline validation on blur (not on every keystroke), errors summarize at top of form, nothing destructive without typed or dialog confirmation.
- Language & literacy: plain language at ~6th-grade reading level; number + unit ("2:30 PM in 3 days"); translation-ready strings (`next-intl`); support phone number present on every page.
- Performance per fairness: booking flow works on a throttled 3G connection and a 5-year-old Android; server-rendered content, images lazy, JS budget < 200KB gzipped on patient pages.
