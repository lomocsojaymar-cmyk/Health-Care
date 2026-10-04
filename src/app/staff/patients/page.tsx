import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { PatientForm } from "./patient-form";

export const dynamic = "force-dynamic";

export default async function StaffPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q } = await searchParams;
  const db = readDb();
  const query = (q ?? "").trim().toLowerCase();

  const patients = db.patients
    .filter((p) => {
      if (!query) return true;
      return (
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(query) ||
        p.phone.toLowerCase().includes(query) ||
        p.email.toLowerCase().includes(query) ||
        p.dateOfBirth.includes(query)
      );
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">Patients</h1>
          <p className="sub">{db.patients.length} registered · {db.patients.filter((p) => p.status === "ACTIVE").length} active</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}>
        <section className="card">
          <div className="card-head">
            <h2>Directory</h2>
            <span className="spacer" />
            <form style={{ display: "flex", gap: 8 }}>
              <input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Search name, phone, DOB…"
                style={{
                  minWidth: 220, minHeight: 40, padding: "8px 12px",
                  border: "1px solid var(--neutral-300)", borderRadius: 8, font: "inherit", fontSize: "0.9rem",
                }}
                aria-label="Search patients"
              />
              <button className="btn btn-secondary btn-sm">Search</button>
            </form>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="right"></th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="rowlink">
                    <td>
                      <strong>{p.lastName}, {p.firstName}</strong>
                      <div className="small muted">DOB {p.dateOfBirth}</div>
                    </td>
                    <td className="muted">{p.phone}</td>
                    <td>
                      <span className={`badge ${p.status === "ACTIVE" ? "badge-active" : "badge-inactive"}`}>
                        <span className="dot" aria-hidden="true" />
                        {p.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="td-actions">
                      <Link className="btn btn-ghost btn-sm" href={`/staff/patients/${p.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr><td colSpan={4} className="empty">No patients match "{q}".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card card-pad">
          <h2>Register new patient</h2>
          <p className="muted small">Walk-in intake — takes a minute.</p>
          <PatientForm />
        </section>
      </div>
    </div>
  );
}
