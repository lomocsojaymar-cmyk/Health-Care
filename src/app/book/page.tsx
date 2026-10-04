import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { upcomingDates } from "@/lib/scheduling";
import { BookingWizard } from "./booking-wizard";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ reschedule?: string }>;
}) {
  const actor = await getActor();
  if (actor.kind === "guest") redirect("/login");
  if (actor.kind === "staff") redirect("/staff/schedule/new");
  if (actor.kind === "patient") {
    const { reschedule } = await searchParams;
    const db = readDb();
    const providers = db.providers.filter((p) => p.status === "ACTIVE");
    const dates = upcomingDates(21);
    return (
      <BookingWizard
        mode="self"
        patientId={actor.patient.id}
        patientName={`${actor.patient.firstName} ${actor.patient.lastName}`}
        rescheduleId={reschedule ?? null}
        providers={providers.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          specialty: p.specialty,
          slotMinutes: p.slotMinutes,
        }))}
        dates={dates}
      />
    );
  }
}
