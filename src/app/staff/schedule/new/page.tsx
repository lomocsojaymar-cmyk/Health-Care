import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { upcomingDates } from "@/lib/scheduling";
import { BookingWizard } from "@/app/book/booking-wizard";

export default async function StaffBookForPatientPage() {
  const actor = await requireStaff();
  const db = readDb();
  const active = db.patients.filter((p) => p.status === "ACTIVE");

  if (active.length === 0) {
    return (
      <div className="empty card">
        <div className="icon">👤</div>
        <h2>No active patients</h2>
        <p>Add a patient first from the Patients tab.</p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">Book for a patient</h1>
          <p className="sub">Phone / walk-in bookings, logged as staff bookings.</p>
        </div>
      </div>

      <section className="card card-pad">
        <h2>1 · Select patient</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Phone</th>
                <th scope="col" className="right"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.firstName} {p.lastName}</strong> <span className="small muted">DOB {p.dateOfBirth}</span></td>
                  <td className="muted">{p.phone}</td>
                  <td className="td-actions">
                    <a href={`/staff/schedule/new/${p.id}`} className="btn btn-secondary btn-sm">Book →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export const revalidate = 0;
