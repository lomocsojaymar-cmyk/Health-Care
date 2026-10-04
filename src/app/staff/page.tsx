import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { scheduleForDay, dateKey, fmtTime } from "@/lib/scheduling";
import { StatusBadge } from "@/components/ui";
import { ScheduleActions } from "./schedule-actions";
import { DayPicker } from "./day-picker";

export const dynamic = "force-dynamic";

export default async function StaffSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireStaff();
  const { date: dateParam } = await searchParams;
  const db = readDb();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : dateKey(new Date());
  const items = scheduleForDay(db, date);

  const stats = {
    scheduled: items.filter((s) => s.appointment.status === "SCHEDULED").length,
    completed: items.filter((s) => s.appointment.status === "COMPLETED").length,
    noShows: items.filter((s) => s.appointment.status === "NO_SHOW").length,
    cancelled: items.filter((s) => s.appointment.status === "CANCELLED").length,
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">Schedule</h1>
          <p className="sub">
            {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {items.length} appointment{items.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="spacer" />
        <Link href="/staff/schedule/new" className="btn btn-primary">Book for patient</Link>
      </div>

      <DayPicker date={date} />
      <div className="stat-row">
        <div className="stat"><div className="label">Scheduled</div><div className="value">{stats.scheduled}</div></div>
        <div className="stat"><div className="label">Completed</div><div className="value ok">{stats.completed}</div></div>
        <div className="stat"><div className="label">No-shows</div><div className="value warn">{stats.noShows}</div></div>
        <div className="stat"><div className="label">Cancelled</div><div className="value">{stats.cancelled}</div></div>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Day view</h2>
          <span className="spacer" />
          <span className="muted small">Click a row's actions to update status</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Patient</th>
                <th scope="col">Provider</th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ appointment: a, patient, provider }) => (
                <tr key={a.id}>
                  <td className="td-time">{fmtTime(a.startsAt)}</td>
                  <td>
                    <strong>{patient.firstName} {patient.lastName}</strong>
                    <div className="small muted">{patient.phone}</div>
                  </td>
                  <td>{provider.fullName}</td>
                  <td className="muted">{a.reason}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="td-actions">
                    <ScheduleActions
                      appointmentId={a.id}
                      status={a.status}
                      startsAt={a.startsAt}
                    />
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    <div className="icon">📭</div>
                    No appointments on this date.
                    <div className="mt-16">
                      <Link href="/staff/schedule/new" className="btn btn-secondary btn-sm">Book one</Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
