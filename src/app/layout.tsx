import type { Metadata } from "next";
import Link from "next/link";
import { getActor } from "@/lib/auth";
import { logout } from "@/lib/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHAS · Community Health Appointments",
  description:
    "Book, reschedule, and manage community clinic appointments — for patients and staff.",
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 2 && w.toLowerCase() !== "dr.")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <header className="site-header">
          <div className="container inner">
            <Link href="/" className="brand">
              <span className="brand-mark">✚</span>
              <span>CHAS&nbsp;<span className="muted" style={{ fontWeight: 500 }}>Health</span></span>
            </Link>
            <nav className="nav" aria-label="Primary">
              {actor.kind === "staff" ? (
                <>
                  <Link href="/staff">Schedule</Link>
                  <Link href="/staff/patients">Patients</Link>
                  <Link href="/staff/providers">Providers</Link>
                  <Link href="/staff/audit">Audit Log</Link>
                </>
              ) : (
                <>
                  <Link href="/book">Book</Link>
                  {actor.kind === "patient" && <Link href="/my">My Appointments</Link>}
                  <Link href="/login">Sign in</Link>
                </>
              )}
            </nav>
            <div className="header-actions">
              {actor.kind === "staff" && (
                <span className="badge badge-neutral">
                  <span className="dot" />
                  {actor.name}
                </span>
              )}
              {actor.kind === "patient" && (
                <span className="badge badge-neutral">
                  <span className="avatar sm" aria-hidden="true">
                    {initials(`${actor.patient.firstName} ${actor.patient.lastName}`)}
                  </span>
                  {actor.patient.firstName}
                </span>
              )}
              {actor.kind !== "guest" && (
                <form action={logout}>
                  <button className="btn btn-ghost btn-sm" type="submit">Sign out</button>
                </form>
              )}
            </div>
          </div>
        </header>
        <main id="main" className="container page">{children}</main>
        <footer className="site-footer">
          <div className="container flex">
            <span>© 2026 Community Health Appointment System</span>
            <span className="spacer" />
            <span>Support: <strong>(555) 010-2000</strong> · Mon–Fri 8:00–18:00</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
