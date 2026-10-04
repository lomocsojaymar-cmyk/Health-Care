import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { EntityBadge } from "@/components/ui";
import { ProviderEditor } from "./provider-editor";

export const dynamic = "force-dynamic";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function ProvidersPage() {
  await requireStaff();
  const db = readDb();

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="mt-0">Providers & availability</h1>
          <p className="sub">Roster, weekly hours, and slot settings.</p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.35fr 1fr", alignItems: "start" }}>
        <section className="stack">
          {db.providers.map((p) => {
            const templates = db.availabilityTemplates.filter((t) => t.providerId === p.id);
            return (
              <div className="card" key={p.id}>
                <div className="card-head">
                  <span className="avatar sm" aria-hidden="true">
                    {p.fullName.replace("Dr. ", "").split(" ").slice(0, 2).map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <h2 style={{ margin: 0 }}>{p.fullName}</h2>
                    <span className="small muted">
                      {p.credentials} · {p.specialty}
                    </span>
                  </div>
                  <span className="spacer" />
                  <EntityBadge status={p.status} />
                  <Link className="btn btn-ghost btn-sm" href={`/staff/providers/${p.id}`}>
                    Manage
                  </Link>
                </div>
                <div className="card-pad-sm table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">Hours</th>
                        <th scope="col">Slot / buffer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DOW.map((label, weekday) => {
                        const t = templates.find((x) => x.weekday === weekday);
                        return (
                          <tr key={label}>
                            <td>{label}</td>
                            <td>
                              {t ? `${t.startTime}–${t.endTime}` : <span className="muted">Closed</span>}
                            </td>
                            {weekday === 1 && (
                              <td rowSpan={5}>{p.slotMinutes} min · buffer {p.bufferMinutes} min</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </section>

        <section className="card card-pad">
          <h2>Add a provider</h2>
          <p className="muted small">New staff members appear in the booking flow immediately.</p>
          <ProviderEditor mode="create" />
        </section>
      </div>
    </div>
  );
}
