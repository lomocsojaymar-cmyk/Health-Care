/**
 * Seed script: generates a realistic demo dataset — 4 providers with weekly
 * hours, 12 patients, and ~3 weeks of appointment history (past = completed /
 * no-show / cancelled, future = scheduled). Deterministic (seeded PRNG).
 *
 * Run: npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import type {
  Appointment,
  AppointmentStatus,
  AuditLogEntry,
  AvailabilityTemplate,
  Database,
  Patient,
  Provider,
  ScheduleException,
  StatusHistoryEntry,
} from "../src/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "chas.json");

// Deterministic PRNG (mulberry32) so every seed run is identical.
let s = 42;
const rand = () => {
  s |= 0;
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function localIso(d: Date): string {
  // Format a Date as local "YYYY-MM-DDTHH:MM:SS.sss" (no Z) for clinic-local datetimes.
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.` +
    `${pad(d.getMilliseconds(), 3)}`
  );
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const c = new Date(day);
  c.setHours(h, m, 0, 0);
  return c;
}

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

// ---------- Providers ----------
const providers: Provider[] = [
  {
    id: "prv-ada",
    fullName: "Dr. Adaeze Okafor",
    credentials: "MD",
    specialty: "Family Medicine",
    email: "a.okafor@chas.clinic",
    phone: "(555) 201-3301",
    slotMinutes: 30,
    bufferMinutes: 5,
    status: "ACTIVE",
    createdAt: localIso(addDays(today, -400)),
    updatedAt: localIso(addDays(today, -30)),
  },
  {
    id: "prv-luis",
    fullName: "Dr. Luis Herrera",
    credentials: "MD",
    specialty: "Internal Medicine",
    email: "l.herrera@chas.clinic",
    phone: "(555) 201-3302",
    slotMinutes: 30,
    bufferMinutes: 0,
    status: "ACTIVE",
    createdAt: localIso(addDays(today, -380)),
    updatedAt: localIso(addDays(today, -30)),
  },
  {
    id: "prv-meera",
    fullName: "Dr. Meera Shah",
    credentials: "DO",
    specialty: "Pediatrics",
    email: "m.shah@chas.clinic",
    phone: "(555) 201-3303",
    slotMinutes: 20,
    bufferMinutes: 5,
    status: "ACTIVE",
    createdAt: localIso(addDays(today, -200)),
    updatedAt: localIso(addDays(today, -30)),
  },
  {
    id: "prv-june",
    fullName: "June Park",
    credentials: "NP",
    specialty: "General Practice",
    email: "j.park@chas.clinic",
    phone: "(555) 201-3304",
    slotMinutes: 30,
    bufferMinutes: 10,
    status: "ACTIVE",
    createdAt: localIso(addDays(today, -150)),
    updatedAt: localIso(addDays(today, -30)),
  },
];

// ---------- Availability templates (weekly hours) ----------
const templates: AvailabilityTemplate[] = [];
for (const p of providers) {
  const weekday = p.id;
  const wd = weekday === "prv-ada" ? [1, 2, 4, 5] : weekday === "prv-meera" ? [1, 3, 5] : [1, 2, 3, 4, 5];
  const window = p.id === "prv-meera" ? ["09:00", "16:00"] : ["08:30", "17:00"];
  for (const d of wd) {
    templates.push({
      id: `tpl-${p.id}-${d}`,
      providerId: p.id,
      weekday: d,
      startTime: window[0],
      endTime: window[1],
    });
  }
}

// Exceptions: June Park is off next Friday (training day).
const exceptions: ScheduleException[] = [
  {
    id: "exc-june-off",
    providerId: "prv-june",
    date: isoDate(addDays(today, ((5 - today.getDay() + 7) % 7) + 7)),
    isDayOff: true,
    newStartTime: null,
    newEndTime: null,
    reason: "Continuing education day",
  },
];

// ---------- Patients ----------
const patientSeed: Array<[string, string, string, number, string]> = [
  ["Amara", "Nwosu", "F", 34, "amara.nwosu@example.com"],
  ["Daniel", "Reyes", "M", 58, "daniel.reyes@example.com"],
  ["Grace", "Chen", "F", 71, "grace.chen@example.com"],
  ["Marcus", "Johnson", "M", 45, "marcus.johnson@example.com"],
  ["Sofia", "Alvarez", "F", 29, "sofia.alvarez@example.com"],
  ["Elijah", "Brooks", "M", 62, "elijah.brooks@example.com"],
  ["Priya", "Patel", "F", 38, "priya.patel@example.com"],
  ["Tom", "Nguyen", "M", 52, "tom.nguyen@example.com"],
  ["Rosa", "Martinez", "F", 66, "rosa.martinez@example.com"],
  ["Kevin", "O'Brien", "M", 41, "kevin.obrien@example.com"],
  ["Nadia", "Hassan", "F", 23, "nadia.hassan@example.com"],
  ["Walter", "Simmons", "M", 77, "walter.simmons@example.com"],
];

const patients: Patient[] = patientSeed.map(([first, last, sex, age, email], i) => {
  const birthYear = now.getFullYear() - age;
  return {
    id: `pat-${String(i + 1).padStart(3, "0")}`,
    firstName: first,
    lastName: last,
    dateOfBirth: `${birthYear}-0${(i % 9) + 1}-1${(i % 9)}`,
    phone: `(555) 3${String(i).padStart(2, "0")}-1${String(100 + i * 7).slice(0, 3)}`,
    email,
    addressLine: `${120 + i * 13} Community Way`,
    city: "Springfield",
    postcode: "62704",
    emergencyContactName: pick([
      "Spouse", "Adult child", "Sibling", "Parent", "Friend",
    ]),
    emergencyContactPhone: `(555) 8${String(i).padStart(2, "0")}-4${String(200 + i * 11).slice(0, 3)}`,
    status: i === 11 ? "INACTIVE" : "ACTIVE", // Walter deactivated (moved away)
    createdAt: localIso(addDays(today, -300 + i * 9)),
    updatedAt: localIso(addDays(today, -10 - i)),
  };
});

// ---------- Appointments ----------
const reasons = [
  "Annual check-up",
  "Sick visit",
  "Chronic care follow-up",
  "Vaccination",
  "Blood pressure review",
  "Medication review",
  "Lab results discussion",
  "Skin concern",
];

const appointments: Appointment[] = [];
const statusHistory: StatusHistoryEntry[] = [];

function addAppt(
  patient: Patient,
  provider: Provider,
  dayOffset: number,
  hhmm: string,
  status: AppointmentStatus,
  bookedBy: "PATIENT" | "STAFF",
): void {
  const day = addDays(today, dayOffset);
  const start = atTime(day, hhmm);
  const end = new Date(start.getTime() + provider.slotMinutes * 60000);
  const a: Appointment = {
    id: `apt-${appointments.length + 1}`,
    patientId: patient.id,
    providerId: provider.id,
    startsAt: localIso(start),
    endsAt: localIso(end),
    status,
    bookedBy,
    reason: pick(reasons),
    staffNotes: "",
    createdAt: localIso(addDays(start, -7)),
    updatedAt: localIso(start),
  };
  appointments.push(a);
  if (status !== "SCHEDULED") {
    statusHistory.push({
      id: `sth-${statusHistory.length + 1}`,
      appointmentId: a.id,
      oldStatus: "SCHEDULED",
      newStatus: status,
      changedBy: status === "COMPLETED" ? "system:visit-end" : "staff:Front Desk",
      at: localIso(end),
    });
  }
}

const active = patients.filter((p) => p.status === "ACTIVE");

// Past 10 weekdays: mostly completed, a couple of cancellations/no-shows.
let cursor = -1;
let madePast = 0;
while (madePast < 14) {
  const day = addDays(today, cursor);
  const dow = day.getDay();
  if (dow !== 0 && dow !== 6) {
    const provider = pick(providers);
    const patient = pick(active);
    const hour = provider.id === "prv-meera" ? pick(["09:00", "10:00", "11:00", "14:00", "15:00"]) : pick(["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"]);
    const roll = rand();
    const status: AppointmentStatus =
      roll < 0.82 ? "COMPLETED" : roll < 0.92 ? "CANCELLED" : "NO_SHOW";
    addAppt(patient, provider, cursor, hour, status, rand() < 0.7 ? "PATIENT" : "STAFF");
    madePast++;
  }
  cursor--;
}

// Next 10 weekdays: scheduled, some booked by staff (phone bookings).
let fwd = 1;
let madeFuture = 0;
while (madeFuture < 16) {
  const day = addDays(today, fwd);
  const dow = day.getDay();
  if (dow !== 0 && dow !== 6) {
    const provider = pick(providers);
    const patient = pick(active);
    const hour = provider.id === "prv-meera" ? pick(["09:20", "10:00", "10:40", "14:00", "15:20"]) : pick(["09:00", "09:30", "10:30", "11:00", "13:30", "14:30", "15:30", "16:00"]);
    addAppt(patient, provider, fwd, hour, "SCHEDULED", rand() < 0.6 ? "PATIENT" : "STAFF");
    madeFuture++;
  }
  fwd++;
}

// Grace Chen (older adult) always books by phone.
for (const a of appointments) {
  if (a.patientId === "pat-003") a.bookedBy = "STAFF";
}

// ---------- Audit log (seed narrative) ----------
const auditLog: AuditLogEntry[] = [
  {
    id: "aud-1",
    at: new Date(now.getTime() - 26 * 3600_000).toISOString(),
    actor: "staff:Front Desk",
    action: "APPOINTMENT_BOOKED",
    entity: "APPOINTMENT",
    entityId: "apt-30",
    summary: "Phone booking for Grace Chen with Dr. Meera Shah",
  },
  {
    id: "aud-2",
    at: new Date(now.getTime() - 30 * 3600_000).toISOString(),
    actor: "staff:Front Desk",
    action: "APPOINTMENT_STATUS_CHANGED",
    entity: "APPOINTMENT",
    entityId: "apt-12",
    summary: "Marked NO_SHOW (3rd in 12 months) — Elijah Brooks",
  },
  {
    id: "aud-3",
    at: new Date(now.getTime() - 52 * 3600_000).toISOString(),
    actor: "system:seed",
    action: "PROVIDER_CREATED",
    entity: "PROVIDER",
    entityId: "prv-june",
    summary: "June Park, NP added to the roster",
  },
];

// ---------- Write ----------
const db: Database = {
  patients,
  providers,
  availabilityTemplates: templates,
  scheduleExceptions: exceptions,
  appointments,
  statusHistory,
  auditLog,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");

console.log(
  `Seeded ${patients.length} patients, ${providers.length} providers, ` +
    `${appointments.length} appointments (${appointments.filter((a) => a.status === "SCHEDULED").length} upcoming) → data/chas.json`,
);
