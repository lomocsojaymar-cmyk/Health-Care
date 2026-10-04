import { readDb } from "@/lib/store";
import { getActor } from "@/lib/auth";
import { loginAs } from "@/lib/actions";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const actor = await getActor();
  if (actor.kind !== "guest") redirect(actor.kind === "staff" ? "/staff" : "/my");

  const patients = readDb()
    .patients.filter((p) => p.status === "ACTIVE")
    .sort((a, b) => a.lastName.localeCompare(b.lastName));

  async function signIn(formData: FormData) {
    "use server";
    const role = String(formData.get("role"));
    const patientId = String(formData.get("patientId") ?? "");
    await loginAs(role as "patient" | "staff" | "admin", patientId || undefined);
    redirect(role === "patient" ? "/my" : "/staff");
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h1>Sign in</h1>
      <p className="muted">
        Demo mode — in production this page uses email + password with role-based
        access (see AGENTS.md, auth seam).
      </p>

      <section className="card card-pad mb-16">
        <h2>Staff</h2>
        <p className="muted small">Front desk and clinic admin access.</p>
        <div className="flex">
          <form action={signIn}>
            <input type="hidden" name="role" value="staff" />
            <button className="btn btn-primary">Continue as Front Desk</button>
          </form>
          <form action={signIn}>
            <input type="hidden" name="role" value="admin" />
            <button className="btn btn-secondary">Continue as Admin</button>
          </form>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Patient</h2>
          <span className="spacer" />
          <span className="muted small">Choose a demo profile</span>
        </div>
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
              {patients.map((p) => (
                <tr key={p.id} className="rowlink">
                  <td>
                    <div className="flex" style={{ flexWrap: "nowrap" }}>
                      <span className="avatar sm" aria-hidden="true">
                        {p.firstName[0]}{p.lastName[0]}
                      </span>
                      <span>
                        <strong>{p.firstName} {p.lastName}</strong>
                        <div className="small muted">{p.email || "No email"}</div>
                      </span>
                    </div>
                  </td>
                  <td className="muted">{p.phone}</td>
                  <td className="td-actions">
                    <form action={signIn}>
                      <input type="hidden" name="role" value="patient" />
                      <input type="hidden" name="patientId" value={p.id} />
                      <button className="btn btn-secondary btn-sm">Sign in</button>
                    </form>
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
