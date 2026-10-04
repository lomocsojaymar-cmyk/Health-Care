"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { appendAudit, withDb } from "@/lib/store";
import {
  SchedulingError,
  bookAppointment,
  canPatientCancel,
  rescheduleAppointment,
  setAppointmentStatus,
} from "@/lib/scheduling";
import {
  bookingSchema,
  hoursSchema,
  patientSchema,
  providerSchema,
  rescheduleSchema,
  type PatientInput,
  type ProviderInput,
} from "@/lib/schemas";
import { getActor, actorLabel, SESSION_COOKIE } from "@/lib/auth";
import type {
  Appointment,
  AvailabilityTemplate,
  Database,
  Patient,
  Provider,
  ScheduleException,
} from "@/lib/types";

export interface ActionResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function zodErr(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): {
  ok: false;
  error: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}

function revalidateAll(): void {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// PATIENTS — Create / Read / Update / Delete(deactivate)
// ---------------------------------------------------------------------------

export async function createPatient(
  input: PatientInput,
): Promise<ActionResult<Patient>> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) return zodErr(parsed.error);

  return withDb((db) => {
    if (parsed.data.email && db.patients.some((p) => p.email === parsed.data.email)) {
      return { ok: false as const, error: "A patient with this email already exists." };
    }
    const now = new Date().toISOString();
    const patient: Patient = {
      id: `pat-${crypto.randomUUID().slice(0, 8)}`,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
      phone: parsed.data.phone,
      email: parsed.data.email,
      addressLine: parsed.data.addressLine,
      city: parsed.data.city,
      postcode: parsed.data.postcode,
      emergencyContactName: parsed.data.emergencyContactName,
      emergencyContactPhone: parsed.data.emergencyContactPhone,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    db.patients.push(patient);
    appendAudit(db, {
      actor: "staff:Front Desk",
      action: "PATIENT_CREATED",
      entity: "PATIENT",
      entityId: patient.id,
      summary: `Registered ${patient.firstName} ${patient.lastName}`,
    });
    return { ok: true as const, data: patient };
  }).then((r) => {
    if (r.ok) revalidateAll();
    return r;
  });
}

export async function updatePatient(
  patientId: string,
  input: PatientInput,
): Promise<ActionResult<Patient>> {
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) return zodErr(parsed.error);

  return withDb((db) => {
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { ok: false as const, error: "Patient not found." };
    const email = parsed.data.email;
    if (email && db.patients.some((p) => p.email === email && p.id !== patientId)) {
      return { ok: false as const, error: "Another patient already uses this email." };
    }
    Object.assign(patient, parsed.data, { email, updatedAt: new Date().toISOString() });
    appendAudit(db, {
      actor: "staff:Front Desk",
      action: "PATIENT_UPDATED",
      entity: "PATIENT",
      entityId: patient.id,
      summary: `Updated contact details for ${patient.firstName} ${patient.lastName}`,
    });
    return { ok: true as const, data: patient };
  }).then((r) => {
    if (r.ok) revalidateAll();
    return r;
  });
}

/** Delete = soft delete: patients are deactivated, never hard-deleted (doc 02). */
export async function deactivatePatient(
  patientId: string,
  actorLabelStr: string,
): Promise<ActionResult<Patient>> {
  return withDb((db) => {
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { ok: false as const, error: "Patient not found." };
    patient.status = "INACTIVE";
    patient.updatedAt = new Date().toISOString();
    // Cancel upcoming appointments so slots are released.
    for (const a of db.appointments) {
      if (
        a.patientId === patientId &&
        a.status === "SCHEDULED" &&
        new Date(a.startsAt) > new Date()
      ) {
        setAppointmentStatus(db, a.id, "CANCELLED", actorLabelStr);
      }
    }
    appendAudit(db, {
      actor: actorLabelStr || "staff:Front Desk",
      action: "PATIENT_DEACTIVATED",
      entity: "PATIENT",
      entityId: patient.id,
      summary: `Deactivated account for ${patient.firstName} ${patient.lastName}`,
    });
    return { ok: true as const, data: patient };
  }).then((r) => {
    if (r.ok) revalidateAll();
    return r;
  });
}

export async function reactivatePatient(patientId: string): Promise<ActionResult<Patient>> {
  return withDb((db) => {
    const patient = db.patients.find((p) => p.id === patientId);
    if (!patient) return { ok: false as const, error: "Patient not found." };
    patient.status = "ACTIVE";
    patient.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: "staff:Front Desk",
      action: "PATIENT_REACTIVATED",
      entity: "PATIENT",
      entityId: patient.id,
      summary: `Reactivated account for ${patient.firstName} ${patient.lastName}`,
    });
    return { ok: true as const, data: patient };
  }).then((r) => {
    if (r.ok) revalidateAll();
    return r;
  });
}

// ---------------------------------------------------------------------------
// APPOINTMENTS — Book / Read / Reschedule+Status / Cancel
// ---------------------------------------------------------------------------

export async function bookAppointmentAction(
  input: unknown,
): Promise<ActionResult<Appointment>> {
  const actor = await getActor();
  const isStaff = actor.kind === "staff";
  const candidate = {
    ...(input as Record<string, unknown>),
    patientId: isStaff
      ? str((input as Record<string, unknown>).patientId)
      : actor.kind === "patient"
        ? actor.patient.id
        : "",
  };
  const parsed = bookingSchema.safeParse(candidate);
  if (!parsed.success) return zodErr(parsed.error);

  try {
    const result = await withDb((db) => {
      const appt = bookAppointment(db, {
        patientId: parsed.data.patientId,
        providerId: parsed.data.providerId,
        startsAt: parsed.data.startsAt,
        reason: parsed.data.reason,
        bookedBy: isStaff ? "STAFF" : "PATIENT",
        actor: actorLabel(actor),
      });
      appendAudit(db, {
        actor: actorLabel(actor),
        action: "APPOINTMENT_BOOKED",
        entity: "APPOINTMENT",
        entityId: appt.id,
        summary: `${isStaff ? "Staff" : "Patient"} booking — ${parsed.data.startsAt.replace("T", " ")}`,
      });
      return { ok: true as const, data: appt };
    });
    revalidateAll();
    return result;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SchedulingError
          ? e.message
          : "Could not book the appointment. Please try again.",
    };
  }
}

export async function rescheduleAppointmentAction(
  input: unknown,
): Promise<ActionResult<Appointment>> {
  const actor = await getActor();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return zodErr(parsed.error);
  const { appointmentId, startsAt } = parsed.data;

  try {
    const result = await withDb((db) => {
      const appt = db.appointments.find((a) => a.id === appointmentId);
      if (!appt) return { ok: false as const, error: "Appointment not found." };
      if (actor.kind === "patient" && appt.patientId !== actor.patient.id) {
        return { ok: false as const, error: "You can only manage your own appointments." };
      }
      if (actor.kind === "patient" && !canPatientCancel(appt)) {
        return { ok: false as const, error: "Rescheduling is available up to 12 hours before the visit. Please call the front desk." };
      }
      const moved = rescheduleAppointment(db, appointmentId, startsAt);
      appendAudit(db, {
        actor: actorLabel(actor),
        action: "APPOINTMENT_RESCHEDULED",
        entity: "APPOINTMENT",
        entityId: appt.id,
        summary: `Moved to ${startsAt.replace("T", " ")}`,
      });
      return { ok: true as const, data: moved };
    });
    revalidateAll();
    return result;
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof SchedulingError
          ? e.message
          : "Could not reschedule. Please try again.",
    };
  }
}

export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<ActionResult<Appointment>> {
  const actor = await getActor();
  try {
    const result = await withDb((db) => {
      const appt = db.appointments.find((a) => a.id === appointmentId);
      if (!appt) return { ok: false as const, error: "Appointment not found." };
      if (actor.kind === "patient" && appt.patientId !== actor.patient.id) {
        return { ok: false as const, error: "You can only manage your own appointments." };
      }
      if (actor.kind === "patient" && !canPatientCancel(appt)) {
        return { ok: false as const, error: "Cancelling is available up to 12 hours before the visit. Please call the front desk." };
      }
      const cancelled = setAppointmentStatus(db, appointmentId, "CANCELLED", actorLabel(actor));
      appendAudit(db, {
        actor: actorLabel(actor),
        action: "APPOINTMENT_CANCELLED",
        entity: "APPOINTMENT",
        entityId: appt.id,
        summary: "Cancelled by " + (actor.kind === "patient" ? "patient" : "staff"),
      });
      return { ok: true as const, data: cancelled };
    });
    revalidateAll();
    return result;
  } catch {
    return { ok: false, error: "Could not cancel. Please try again." };
  }
}

export async function setAppointmentStatusAction(
  appointmentId: string,
  newStatus: "COMPLETED" | "NO_SHOW" | "CANCELLED" | "SCHEDULED",
): Promise<ActionResult<Appointment>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  try {
    const result = await withDb((db) => {
      const updated = setAppointmentStatus(db, appointmentId, newStatus, actorLabel(actor));
      appendAudit(db, {
        actor: actorLabel(actor),
        action: "APPOINTMENT_STATUS_CHANGED",
        entity: "APPOINTMENT",
        entityId: appointmentId,
        summary: `Status set to ${newStatus.replace("_", " ")}`,
      });
      return { ok: true as const, data: updated };
    });
    revalidateAll();
    return result;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof SchedulingError ? e.message : "Could not update status.",
    };
  }
}

// ---------------------------------------------------------------------------
// PROVIDERS — Create / Read / Update hours / Delete(deactivate)
// ---------------------------------------------------------------------------

export async function createProvider(
  input: ProviderInput,
): Promise<ActionResult<Provider>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) return zodErr(parsed.error);

  const result = await withDb((db) => {
    const now = new Date().toISOString();
    const provider: Provider = {
      id: `prv-${crypto.randomUUID().slice(0, 8)}`,
      fullName: parsed.data.fullName,
      credentials: parsed.data.credentials,
      specialty: parsed.data.specialty,
      email: parsed.data.email,
      phone: parsed.data.phone,
      slotMinutes: parsed.data.slotMinutes,
      bufferMinutes: parsed.data.bufferMinutes,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    db.providers.push(provider);
    appendAudit(db, {
      actor: actorLabel(actor),
      action: "PROVIDER_CREATED",
      entity: "PROVIDER",
      entityId: provider.id,
      summary: `Added ${provider.fullName} (${provider.specialty})`,
    });
    return { ok: true as const, data: provider };
  });
  revalidateAll();
  return result;
}

export async function updateProviderHours(
  input: unknown,
): Promise<ActionResult<Provider>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return zodErr(parsed.error);
  const { providerId, windows, slotMinutes, bufferMinutes } = parsed.data;

  const result = await withDb((db) => {
    const provider = db.providers.find((p) => p.id === providerId);
    if (!provider) return { ok: false as const, error: "Provider not found." };

    // Replace the weekly template with the new windows.
    db.availabilityTemplates = db.availabilityTemplates.filter(
      (t) => t.providerId !== providerId,
    );
    windows.forEach((w, weekday) => {
      if (!w) return;
      const [s, e] = w.split("-");
      db.availabilityTemplates.push({
        id: `tpl-${providerId}-${weekday}-${crypto.randomUUID().slice(0, 4)}`,
        providerId,
        weekday,
        startTime: s,
        endTime: e,
      });
    });

    provider.slotMinutes = slotMinutes;
    provider.bufferMinutes = bufferMinutes;
    provider.updatedAt = new Date().toISOString();

    appendAudit(db, {
      actor: actorLabel(actor),
      action: "PROVIDER_HOURS_UPDATED",
      entity: "AVAILABILITY",
      entityId: providerId,
      summary: `Weekly hours updated for ${provider.fullName}`,
    });
    return { ok: true as const, data: provider };
  });
  revalidateAll();
  return result;
}

export async function addDayOff(
  input: { providerId: string; date: string; reason: string },
): Promise<ActionResult<ScheduleException>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false, error: "Pick a valid date." };
  }
  const result = await withDb((db) => {
    const existing = db.scheduleExceptions.find(
      (e) => e.providerId === input.providerId && e.date === input.date,
    );
    if (existing) {
      existing.isDayOff = true;
      existing.newStartTime = null;
      existing.newEndTime = null;
      existing.reason = input.reason || existing.reason;
    } else {
      db.scheduleExceptions.push({
        id: `exc-${crypto.randomUUID().slice(0, 8)}`,
        providerId: input.providerId,
        date: input.date,
        isDayOff: true,
        newStartTime: null,
        newEndTime: null,
        reason: input.reason || "Day off",
      });
    }
    const provider = db.providers.find((p) => p.id === input.providerId);
    appendAudit(db, {
      actor: actorLabel(actor),
      action: "PROVIDER_DAY_OFF_SET",
      entity: "AVAILABILITY",
      entityId: input.providerId,
      summary: `Day off on ${input.date} for ${provider?.fullName ?? input.providerId}`,
    });
    const exc =
      db.scheduleExceptions.find(
        (e) => e.providerId === input.providerId && e.date === input.date,
      ) ?? null;
    return { ok: true as const, data: exc! };
  });
  revalidateAll();
  return result;
}

/** Delete = soft delete for providers too (history must survive). */
export async function deactivateProvider(
  providerId: string,
): Promise<ActionResult<Provider>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  const result = await withDb((db) => {
    const provider = db.providers.find((p) => p.id === providerId);
    if (!provider) return { ok: false as const, error: "Provider not found." };
    provider.status = "INACTIVE";
    provider.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: actorLabel(actor),
      action: "PROVIDER_DEACTIVATED",
      entity: "PROVIDER",
      entityId: providerId,
      summary: `Removed ${provider.fullName} from the active roster`,
    });
    return { ok: true as const, data: provider };
  });
  revalidateAll();
  return result;
}

export async function reactivateProvider(
  providerId: string,
): Promise<ActionResult<Provider>> {
  const actor = await getActor();
  if (actor.kind !== "staff") return { ok: false, error: "Staff access required." };
  const result = await withDb((db) => {
    const provider = db.providers.find((p) => p.id === providerId);
    if (!provider) return { ok: false as const, error: "Provider not found." };
    provider.status = "ACTIVE";
    provider.updatedAt = new Date().toISOString();
    appendAudit(db, {
      actor: actorLabel(actor),
      action: "PROVIDER_REACTIVATED",
      entity: "PROVIDER",
      entityId: providerId,
      summary: `Restored ${provider.fullName} to the active roster`,
    });
    return { ok: true as const, data: provider };
  });
  revalidateAll();
  return result;
}

// ---------------------------------------------------------------------------
// DEMO SESSION (replaced by Auth.js in production)
// ---------------------------------------------------------------------------

export async function loginAs(role: "patient" | "staff" | "admin", patientId?: string) {
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    role === "patient" ? `patient:${patientId}` : role,
    { httpOnly: true, sameSite: "lax", path: "/" },
  );
  revalidateAll();
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  revalidateAll();
}
