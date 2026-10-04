// Demo session management (cookie-based). In production this is replaced by
// Auth.js with hashed credentials — the Actor interface is the integration seam.
import "server-only";
import { cookies } from "next/headers";
import { readDb } from "@/lib/store";
import type { Patient } from "@/lib/types";

export type Actor =
  | { kind: "guest" }
  | { kind: "patient"; patient: Patient }
  | { kind: "staff"; name: string; role: "STAFF" | "ADMIN" };

export const SESSION_COOKIE = "chas_session";

export async function getActor(): Promise<Actor> {
  const store = await cookies();
  const v = store.get(SESSION_COOKIE)?.value ?? "";
  if (v.startsWith("patient:")) {
    const id = v.slice("patient:".length);
    const patient = readDb().patients.find(
      (p) => p.id === id && p.status === "ACTIVE",
    );
    if (patient) return { kind: "patient", patient };
  }
  if (v === "staff") return { kind: "staff", name: "Front Desk", role: "STAFF" };
  if (v === "admin") return { kind: "staff", name: "Clinic Admin", role: "ADMIN" };
  return { kind: "guest" };
}

export async function requireStaff(): Promise<Extract<Actor, { kind: "staff" }>> {
  const actor = await getActor();
  if (actor.kind !== "staff") throw new Error("Staff access required");
  return actor;
}

export function actorLabel(actor: Actor): string {
  if (actor.kind === "patient") return `patient:${actor.patient.id}`;
  if (actor.kind === "staff") return `staff:${actor.name}`;
  return "guest";
}
