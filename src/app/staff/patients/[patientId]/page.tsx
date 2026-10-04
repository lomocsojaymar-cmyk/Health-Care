import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { appointmentsForPatient, fmtDate, fmtTime } from "@/lib/scheduling";
import { EntityBadge, StatusBadge } from "@/components/ui";
import { PatientForm } from "../patient-form";
import { DeactivateControls } from "./deactivate-controls";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  await requireStaff();
  const { patientId } = await params;
  const db = readDb();
  const patient = db.patients.find((p) => p.id === patientId);
  if (!patient) notFound();

  const appts = appointmentsForPatient(db, patient.id);
  const providerName = (id: string) =>
    db.providers.find((p) => p.id === id)?.fullName ?? "Unknown";

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link href="/staff/patients">← All patients</Link>
          </p>
          <h1 className="mt-0 mb-0">
            {patient.firstName} {patient.lastName}
          </h1>
          <p className="sub">
            DOB {patient.dateOfBirth} · {patient.phone}
            {patient.email ? ` · ${patient.email}` : ""}
          </p>
        </div>
        <span className="spacer" />
        <EntityBadge status={patient.status} />
      </div>

      <DeactivateControls patientId={patient.id} status={patient.status} />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>Appointment history</h2>
            <span className="spacer" />
            <span className="muted small">{appts.length} total</span>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Provider</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td className="td-time">{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}</td>
                    <td>{providerName(a.providerId)}</td>
                    <td className="muted">{a.reason}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
                {appts.length === 0 && (
                  <tr><td colSpan={4} className="empty">No visits on record.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card-pad-sm" style={{ borderTop: "1px solid var(--neutral-150)" }}>
            <Link className="btn btn-secondary btn-sm" href={`/staff/schedule/new/${patient.id}`}>
              + Book for this patient
            </Link>
          </div>
        </section>

        <section className="card card-pad">
          <h2>Contact details</h2>
          <p className="muted small">Keep this current — reminders go to these contacts.</p>
          <PatientForm existing={patient} />
        </section>
      </div>
    </div>
  );
}
