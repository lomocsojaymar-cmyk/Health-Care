// Scheduling engine: slot generation + booking business rules.
// Pure functions over the Database shape, so they are unit-testable and
// reusable by both patient booking and staff booking flows.
import "server-only";
import type {
  Appointment,
  Database,
  Patient,
  Provider,
} from "@/lib/types";

export class SchedulingError extends Error {
  code: "OUTSIDE_HOURS" | "SLOT_TAKEN" | "POLICY" | "NOT_FOUND";
  constructor(code: SchedulingError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/** Parse "YYYY-MM-DDTHH:mm" (clinic-local) as a local Date. */
export function parseLocal(iso: string): Date {
  // Strip seconds/ms if present; construct as local time (no Z).
  const [datePart, timePart = "00:00"] = iso.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi] = timePart.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function hhmm(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Generate bookable slots for one provider on one date.
 * Rules (doc 02): weekly template − exceptions − existing bookings − buffer,
 * snapped to the provider's slot grid. Past times are excluded.
 */
export function generateSlots(
  db: Database,
  providerId: string,
  date: string, // "YYYY-MM-DD"
): Array<{ startsAt: string; endsAt: string }> {
  const provider = db.providers.find((p) => p.id === providerId);
  if (!provider || provider.status !== "ACTIVE") return [];

  const day = parseLocal(`${date}T00:00`);
  const weekday = day.getDay();
  const exception = db.scheduleExceptions.find(
    (e) => e.providerId === providerId && e.date === date,
  );

  let windows: Array<[string, string]> = [];
  if (exception?.isDayOff) {
    windows = [];
  } else if (exception && exception.newStartTime && exception.newEndTime) {
    windows = [[exception.newStartTime, exception.newEndTime]];
  } else {
    windows = db.availabilityTemplates
      .filter((t) => t.providerId === providerId && t.weekday === weekday)
      .map((t) => [t.startTime, t.endTime] as [string, string]);
  }
  if (windows.length === 0) return [];

  // Existing SCHEDULED bookings that occupy the day (cancelled/no-show free the slot).
  const booked = db.appointments
    .filter(
      (a) =>
        a.providerId === providerId &&
        a.status === "SCHEDULED" &&
        a.startsAt.slice(0, 10) === date,
    )
    .map((a) => ({
      start: parseLocal(a.startsAt),
      end: parseLocal(a.endsAt),
    }));

  const slots: Array<{ startsAt: string; endsAt: string }> = [];
  const now = new Date();
  const slotMs = provider.slotMinutes * 60000;
  const bufferMs = provider.bufferMinutes * 60000;

  for (const [wStart, wEnd] of windows) {
    const windowStart = parseLocal(`${date}T${wStart}`);
    const windowEnd = parseLocal(`${date}T${wEnd}`);
    let t = windowStart.getTime();
    while (t + slotMs <= windowEnd.getTime()) {
      const start = new Date(t);
      const end = new Date(t + slotMs);
      const blocked =
        booked.some((b) => overlaps(start, end, b.start, b.end)) ||
        // keep the buffer clear on both sides of the new slot
        booked.some(
          (b) =>
            overlaps(
              new Date(start.getTime() - bufferMs),
              new Date(end.getTime() + bufferMs),
              b.start,
              b.end,
            ),
        );
      if (!blocked && start > now) {
        slots.push({ startsAt: `${date}T${hhmm(start)}`, endsAt: `${date}T${hhmm(end)}` });
      }
      t += slotMs + bufferMs;
    }
  }
  return slots;
}

/** Next N dates (starting today) formatted as YYYY-MM-DD. */
export function upcomingDates(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => dateKey(addDays(from, i)));
}

export interface BookingInput {
  patientId: string;
  providerId: string;
  startsAt: string; // clinic-local "YYYY-MM-DDTHH:mm"
  reason: string;
  bookedBy: "PATIENT" | "STAFF";
  actor: string;
}

/**
 * Create an appointment inside a transaction-like callback.
 * Re-validates availability at write time (the UI's slot list can be stale).
 */
export function bookAppointment(
  db: Database,
  input: BookingInput,
  now = new Date(),
): Appointment {
  const patient = db.patients.find((p) => p.id === input.patientId);
  if (!patient || patient.status !== "ACTIVE") {
    throw new SchedulingError("NOT_FOUND", "Patient not found or inactive.");
  }
  const provider = db.providers.find((p) => p.id === input.providerId);
  if (!provider || provider.status !== "ACTIVE") {
    throw new SchedulingError("NOT_FOUND", "Provider not found or inactive.");
  }

  const start = parseLocal(input.startsAt);
  if (start.getTime() <= now.getTime()) {
    throw new SchedulingError("POLICY", "Please choose a future time slot.");
  }
  if (start.getTime() > now.getTime() + 90 * 24 * 3600_000) {
    throw new SchedulingError("POLICY", "Booking window is 90 days. Pick a sooner date.");
  }

  // The slot must be one the engine would offer right now.
  const date = input.startsAt.slice(0, 10);
  const offered = generateSlots(db, input.providerId, date).some(
    (s) => s.startsAt === input.startsAt,
  );
  if (!offered) {
    throw new SchedulingError(
      "SLOT_TAKEN",
      "That time is no longer available. Please pick another slot.",
    );
  }

  const end = new Date(start.getTime() + provider.slotMinutes * 60000);
  const appt: Appointment = {
    id: `apt-${crypto.randomUUID().slice(0, 8)}`,
    patientId: input.patientId,
    providerId: input.providerId,
    startsAt: input.startsAt,
    endsAt: `${date}T${hhmm(end)}`,
    status: "SCHEDULED",
    bookedBy: input.bookedBy,
    reason: input.reason,
    staffNotes: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.appointments.push(appt);
  return appt;
}

/**
 * Reschedule within one "transaction": remove old occupancy, re-validate
 * against the slot grid, then move. Status history is untouched (status stays
 * SCHEDULED); the audit log records the move.
 */
export function rescheduleAppointment(
  db: Database,
  appointmentId: string,
  newStartsAt: string,
  now = new Date(),
): Appointment {
  const appt = db.appointments.find((a) => a.id === appointmentId);
  if (!appt) throw new SchedulingError("NOT_FOUND", "Appointment not found.");
  if (appt.status === "COMPLETED") {
    throw new SchedulingError("POLICY", "Completed visits cannot be rescheduled.");
  }

  // Temporarily ignore this appointment's own occupancy.
  const original = { ...appt };
  appt.status = "CANCELLED"; // frees the slot for validation
  try {
    const provider = db.providers.find((p) => p.id === appt.providerId);
    if (!provider) throw new SchedulingError("NOT_FOUND", "Provider not found.");
    const offered = generateSlots(db, provider.id, newStartsAt.slice(0, 10)).some(
      (s) => s.startsAt === newStartsAt,
    );
    if (!offered) {
      throw new SchedulingError(
        "SLOT_TAKEN",
        "That time is no longer available. Please pick another slot.",
      );
    }
    const start = parseLocal(newStartsAt);
    const end = new Date(start.getTime() + provider.slotMinutes * 60000);
    appt.startsAt = newStartsAt;
    appt.endsAt = `${newStartsAt.slice(0, 10)}T${hhmm(end)}`;
    appt.status = original.status;
    appt.updatedAt = now.toISOString();
    return appt;
  } catch (err) {
    // Roll back the temporary status change.
    appt.status = original.status;
    throw err;
  }
}

/** Cancellation cutoff policy (doc 02): 12 hours before start. */
export const CANCELLATION_CUTOFF_HOURS = 12;

export function canPatientCancel(appt: Appointment, now = new Date()): boolean {
  if (appt.status !== "SCHEDULED") return false;
  return parseLocal(appt.startsAt).getTime() - now.getTime() >= CANCELLATION_CUTOFF_HOURS * 3600_000;
}

export function setAppointmentStatus(
  db: Database,
  appointmentId: string,
  newStatus: "COMPLETED" | "CANCELLED" | "NO_SHOW" | "SCHEDULED",
  changedBy: string,
  now = new Date(),
): Appointment {
  const appt = db.appointments.find((a) => a.id === appointmentId);
  if (!appt) throw new SchedulingError("NOT_FOUND", "Appointment not found.");
  if (appt.status === newStatus) return appt;
  const old = appt.status;
  appt.status = newStatus;
  appt.updatedAt = now.toISOString();
  db.statusHistory.unshift({
    id: `sth-${crypto.randomUUID().slice(0, 8)}`,
    appointmentId: appt.id,
    oldStatus: old,
    newStatus,
    changedBy,
    at: now.toISOString(),
  });
  return appt;
}

// ---------- Read helpers for dashboards ----------

export function appointmentsForPatient(db: Database, patientId: string): Appointment[] {
  return db.appointments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
}

export interface ScheduleItem {
  appointment: Appointment;
  patient: Patient;
  provider: Provider;
}

export function scheduleForDay(db: Database, date: string): ScheduleItem[] {
  return db.appointments
    .filter((a) => a.startsAt.slice(0, 10) === date)
    .map((a) => ({
      appointment: a,
      patient: db.patients.find((p) => p.id === a.patientId)!,
      provider: db.providers.find((p) => p.id === a.providerId)!,
    }))
    .filter((s) => s.patient && s.provider)
    .sort((a, b) => (a.appointment.startsAt < b.appointment.startsAt ? -1 : 1));
}

/** Aggregate no-show + completion stats (staff reports tab). */
export function providerStats(db: Database, providerId: string) {
  const appts = db.appointments.filter((a) => a.providerId === providerId);
  const total = appts.length || 1;
  return {
    total: appts.length,
    completed: appts.filter((a) => a.status === "COMPLETED").length,
    noShows: appts.filter((a) => a.status === "NO_SHOW").length,
    cancelled: appts.filter((a) => a.status === "CANCELLED").length,
    upcoming: appts.filter((a) => a.status === "SCHEDULED").length,
    completionRate: Math.round((appts.filter((a) => a.status === "COMPLETED").length / total) * 100),
  };
}

export function fmtTime(iso: string): string {
  return parseLocal(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDate(dateInput: string | Date): string {
  const d = typeof dateInput === "string" ? parseLocal(dateInput) : dateInput;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export { startOfDay, addDays, dateKey };
