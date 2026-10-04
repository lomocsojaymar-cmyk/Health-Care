// Core domain types for the Community Health Appointment System (CHAS)

export type Role = "PATIENT" | "STAFF" | "ADMIN";

export type AppointmentStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type EntityStatus = "ACTIVE" | "INACTIVE";

export type BookedBy = "PATIENT" | "STAFF";

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO "YYYY-MM-DD"
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Provider {
  id: string;
  fullName: string;
  credentials: string;
  specialty: string;
  email: string;
  phone: string;
  slotMinutes: number; // default appointment length
  bufferMinutes: number; // gap between appointments
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

// Recurring weekly working hours; weekday 0=Sunday .. 6=Saturday
export interface AvailabilityTemplate {
  id: string;
  providerId: string;
  weekday: number;
  startTime: string; // "HH:MM" clinic-local
  endTime: string; // "HH:MM" clinic-local
}

// One-off time off / special hours
export interface ScheduleException {
  id: string;
  providerId: string;
  date: string; // "YYYY-MM-DD"
  isDayOff: boolean;
  newStartTime: string | null;
  newEndTime: string | null;
  reason: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  startsAt: string; // ISO datetime (local clinic time)
  endsAt: string;
  status: AppointmentStatus;
  bookedBy: BookedBy;
  reason: string;
  staffNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  appointmentId: string;
  oldStatus: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  changedBy: string; // actor label
  at: string;
}

export interface AuditLogEntry {
  id: string;
  at: string;
  actor: string; // e.g. "patient:pid" | "staff:Front Desk" | "system"
  action: string; // e.g. "APPOINTMENT_BOOKED"
  entity: "PATIENT" | "APPOINTMENT" | "PROVIDER" | "AVAILABILITY";
  entityId: string;
  summary: string;
}

export interface Database {
  patients: Patient[];
  providers: Provider[];
  availabilityTemplates: AvailabilityTemplate[];
  scheduleExceptions: ScheduleException[];
  appointments: Appointment[];
  statusHistory: StatusHistoryEntry[];
  auditLog: AuditLogEntry[];
}
