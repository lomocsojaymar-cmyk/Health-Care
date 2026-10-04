import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { readDb } from "@/lib/store";
import {
  appointmentsForPatient,
  fmtDate,
  fmtTime,
  canPatientCancel,
} from "@/lib/scheduling";
import { StatusBadge } from "@/components/ui";

export default async function MyAppointmentsPage() {
  const actor = await getActor();
  if (actor.kind !== "patient") redirect("/login");

  const db = readDb();
  const appts = appointmentsForPatient(db, actor.patient.id);
  const now = new Date();
  const upcoming = appts
    .filter((a) => a.status === "SCHEDULED" && new Date(a.endsAt) >= now)
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const past = appts.filter((a) => !(a.status === "SCHEDULED" && new Date(a.endsAt) >= now));
  const next = upcoming[0];

  const providerName = (id: string) =>
    db.providers.find((p) => p.id === id)?.fullName ?? "Unknown provider";

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">My appointments</h1>
          <p className="sub">
            Welcome back, {actor.patient.firstName}. Here's your care at a glance.
          </p>
        </div>
        <span className="spacer" />
        <Link href="/book" className="btn btn-primary">+ Book appointment</Link>
      </div>

      {next ? (
        <section className="hero-appointment" aria-label="Next appointment">
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="small" style={{ fontWeight: 600, color: "var(--primary-700)" }}>
              YOUR NEXT VISIT
            </div>
            <div className="when">{fmtDate(next.startsAt)} · {fmtTime(next.startsAt)}</div>
            <div className="who">{providerName(next.providerId)} · {next.reason}</div>
          </div>
          <StatusBadge status={next.status} />
        </section>
      ) : (
        <section className="empty card">
          <div className="icon">🗓️</div>
          <h2>No upcoming visits</h2>
          <p>When you book, it will show up right here.</p>
          <Link href="/book" className="btn btn-primary">Book your first appointment</Link>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Upcoming</h2>
          <span className="spacer" />
          <span className="muted small">{upcoming.length} scheduled</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Provider</th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
                <th scope="col" className="right">Manage</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((a) => (
                <tr key={a.id}>
                  <td className="td-time">{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}</td>
                  <td>{providerName(a.providerId)}</td>
                  <td className="muted">{a.reason}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="td-actions">
                    {canPatientCancel(a) ? (
                      <Link className="btn btn-ghost btn-sm" href={`/book?reschedule=${a.id}`}>
                        Reschedule / Cancel
                      </Link>
                    ) : (
                      <span className="small muted">Call us to change</span>
                    )}
                  </td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr><td colSpan={5} className="empty">Nothing scheduled — you're all caught up.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Past visits</h2>
          <span className="spacer" />
          <span className="muted small">{past.length} records</span>
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
              {past.slice(0, 10).map((a) => (
                <tr key={a.id}>
                  <td className="td-time">{fmtDate(a.startsAt)} · {fmtTime(a.startsAt)}</td>
                  <td>{providerName(a.providerId)}</td>
                  <td className="muted">{a.reason}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
              {past.length === 0 && (
                <tr><td colSpan={4} className="empty">No past visits yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad">
        <div className="flex">
          <div>
            <h2 className="mb-8">Profile & contact info</h2>
            <p className="muted small mb-0">
              {actor.patient.firstName} {actor.patient.lastName} · DOB {actor.patient.dateOfBirth} · {actor.patient.phone}
              {actor.patient.email ? ` · ${actor.patient.email}` : ""}
            </p>
          </div>
          <span className="spacer" />
          <Link href="/staff/patients" className="btn btn-ghost btn-sm">Need a change? Call the front desk</Link>
        </div>
      </section>
    </div>
  );
}
