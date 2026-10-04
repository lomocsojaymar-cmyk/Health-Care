import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  PATIENT_CREATED: "Patient registered",
  PATIENT_UPDATED: "Patient updated",
  PATIENT_DEACTIVATED: "Patient deactivated",
  PATIENT_REACTIVATED: "Patient reactivated",
  APPOINTMENT_BOOKED: "Appointment booked",
  APPOINTMENT_RESCHEDULED: "Appointment rescheduled",
  APPOINTMENT_CANCELLED: "Appointment cancelled",
  APPOINTMENT_STATUS_CHANGED: "Status changed",
  PROVIDER_CREATED: "Provider added",
  PROVIDER_HOURS_UPDATED: "Hours updated",
  PROVIDER_DAY_OFF_SET: "Day off set",
  PROVIDER_DEACTIVATED: "Provider removed",
  PROVIDER_REACTIVATED: "Provider restored",
};

export default async function AuditPage() {
  await requireStaff();
  const db = readDb();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">Audit log</h1>
          <p className="sub">
            Every create, update, and delete across the system — newest first (last 500).
          </p>
        </div>
      </div>

      <section className="card">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Entity</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {db.auditLog.map((entry) => (
                <tr key={entry.id}>
                  <td className="td-time">
                    {new Date(entry.at).toLocaleString("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </td>
                  <td className="muted small">{entry.actor}</td>
                  <td>
                    <span className="badge badge-neutral">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                  </td>
                  <td className="small muted">{entry.entityId}</td>
                  <td>{entry.summary}</td>
                </tr>
              ))}
              {db.auditLog.length === 0 && (
                <tr><td colSpan={5} className="empty">No activity recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
