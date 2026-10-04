import Link from "next/link";
import { getActor } from "@/lib/auth";
import { loginAs } from "@/lib/actions";
import { readDb } from "@/lib/store";

export default async function HomePage() {
  const actor = await getActor();
  const db = readDb();
  const activeProviders = db.providers.filter((p) => p.status === "ACTIVE");

  return (
    <div className="stack">
      <section className="hero-appointment" style={{ padding: "44px 36px" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 className="mt-0" style={{ fontSize: "2.25rem" }}>
            Healthcare that fits <br /> your day.
          </h1>
          <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 480 }}>
            Book a visit at the community health center in under a minute —
            online, by phone, or walk-in. Reminders included.
          </p>
          <div className="flex mt-16">
            <Link href="/book" className="btn btn-primary btn-lg">Book an appointment</Link>
            {actor.kind === "patient" ? (
              <Link href="/my" className="btn btn-secondary btn-lg">My appointments</Link>
            ) : (
              <Link href="/login" className="btn btn-secondary btn-lg">Staff sign-in</Link>
            )}
          </div>
        </div>
        <div className="card card-pad" style={{ minWidth: 250 }}>
          <h2>Clinic at a glance</h2>
          <p className="muted small mb-8">This week at Springfield Community Clinic</p>
          <p><strong>{activeProviders.length}</strong> providers on staff</p>
          <p><strong>{db.patients.filter((p) => p.status === "ACTIVE").length}</strong> registered patients</p>
          <p>
            <strong>{db.appointments.filter((a) => a.status === "SCHEDULED").length}</strong> upcoming visits
          </p>
          <p className="mb-0 small muted">14 Main St · Springfield · Free parking</p>
        </div>
      </section>

      <section className="grid cols-3">
        <div className="card card-pad">
          <h2>For patients</h2>
          <p className="muted">Register once, then book, reschedule, or cancel in a few taps. Large text, plain language, no jargon.</p>
          <Link href="/book" className="btn btn-secondary btn-sm">Start booking →</Link>
        </div>
        <div className="card card-pad">
          <h2>For front desk</h2>
          <p className="muted">One screen for the day: walk-ins, phone bookings, no-shows, reschedules — all logged.</p>
          <Link href="/login" className="btn btn-secondary btn-sm">Open staff view →</Link>
        </div>
        <div className="card card-pad">
          <h2>For providers</h2>
          <p className="muted">See your daily schedule, mark visits complete, and keep availability up to date.</p>
          <Link href="/staff" className="btn btn-secondary btn-sm">View schedule →</Link>
        </div>
        <div className="card card-tint card-pad">
          <h2>Demo mode</h2>
          <p className="muted small">
            Try the full system instantly — pick a role to sign in as:
          </p>
          <div className="flex">
            <form action={async () => { "use server"; await loginAs("patient", "pat-001"); }}>
              <button className="btn btn-primary btn-sm">Patient · Amara</button>
            </form>
            <form action={async () => { "use server"; await loginAs("staff"); }}>
              <button className="btn btn-secondary btn-sm">Front desk</button>
            </form>
            <form action={async () => { "use server"; await loginAs("admin"); }}>
              <button className="btn btn-ghost btn-sm">Admin</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
