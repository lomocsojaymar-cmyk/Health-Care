import { z } from "zod";

const phone = z
  .string()
  .trim()
  .min(7, "Phone number looks too short")
  .max(20, "Phone number looks too long");

export const patientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker to choose a valid date"),
  phone,
  email: z.string().trim().email("Enter a valid email").max(120).or(z.literal("")),
  addressLine: z.string().trim().max(120).or(z.literal("")),
  city: z.string().trim().max(60).or(z.literal("")),
  postcode: z.string().trim().max(12).or(z.literal("")),
  emergencyContactName: z.string().trim().max(80).or(z.literal("")),
  emergencyContactPhone: z.string().trim().max(20).or(z.literal("")),
});

export const providerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  credentials: z.string().trim().max(40).or(z.literal("")),
  specialty: z.string().trim().min(2, "Specialty is required").max(80),
  email: z.string().trim().email("Enter a valid email").max(120).or(z.literal("")),
  phone: z.string().trim().max(20).or(z.literal("")),
  slotMinutes: z.coerce.number().int().min(10).max(120),
  bufferMinutes: z.coerce.number().int().min(0).max(60),
});

export const bookingSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
  reason: z.string().trim().min(2, "Tell us the reason for the visit").max(200),
});

export const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  startsAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time"),
});

export const hoursSchema = z.object({
  providerId: z.string().min(1),
  // 7 weekdays × "HH:MM-HH:MM" or "" (off)
  windows: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM-HH:MM").or(z.literal("")))
    .length(7),
  slotMinutes: z.coerce.number().int().min(10).max(120),
  bufferMinutes: z.coerce.number().int().min(0).max(60),
});

export type PatientInput = z.infer<typeof patientSchema>;
export type ProviderInput = z.infer<typeof providerSchema>;
export type BookingInputData = z.infer<typeof bookingSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type HoursInput = z.infer<typeof hoursSchema>;
