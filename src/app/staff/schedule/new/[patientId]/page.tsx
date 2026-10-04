import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { upcomingDates } from "@/lib/scheduling";
import { BookingWizard } from "@/app/book/booking-wizard";

export default async function StaffBookForPatientFlowPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  await requireStaff();
  const { patientId } = await params;
  const db = readDb();
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  return (
    <BookingWizard
      mode="staff"
      patientId={patient.id}
      patientName={`${patient.firstName} ${patient.lastName}`}
      rescheduleId={null}
      providers={db.providers
        .filter((p) => p.status === "ACTIVE")
        .map((p) => ({
          id: p.id,
          fullName: p.fullName,
          specialty: p.specialty,
          slotMinutes: p.slotMinutes,
        }))}
      dates={upcomingDates(21)}
    />
  );
}
