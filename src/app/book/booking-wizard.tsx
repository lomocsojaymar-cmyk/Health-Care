"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bookAppointmentAction,
  cancelAppointmentAction,
  rescheduleAppointmentAction,
} from "@/lib/actions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/ui";

interface ProviderOption {
  id: string;
  fullName: string;
  specialty: string;
  slotMinutes: number;
}

const REASONS = [
  { icon: "🩺", label: "Check-up" },
  { icon: "🤒", label: "Sick visit" },
  { icon: "❤️", label: "Chronic care follow-up" },
  { icon: "💉", label: "Vaccination" },
  { icon: "🧪", label: "Lab results" },
  { icon: "💊", label: "Medication review" },
  { icon: "🩹", label: "Minor injury" },
  { icon: "📋", label: "Other" },
];

export function BookingWizard({
  mode,
  patientId,
  patientName,
  providers,
  dates,
  rescheduleId,
}: {
  mode: "self" | "staff";
  patientId: string | null;
  patientName: string;
  providers: ProviderOption[];
  dates: string[];
  rescheduleId: string | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(rescheduleId ? 1 : 0);

  const [reason, setReason] = useState("");
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string }>>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const provider = providers.find((p) => p.id === providerId);

  useEffect(() => {
    if (!providerId || !date) return;
    let cancelled = false;
    setSlotsLoading(true);
    setSlotError("");
    const run = async () => {
      try {
        const res = await fetch(
          `/api/slots?providerId=${encodeURIComponent(providerId)}&date=${encodeURIComponent(date)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as { slots?: Array<{ startsAt: string; endsAt: string }>; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Failed to load slots");
        setSlots(json.slots ?? []);
      } catch {
        if (!cancelled) {
          setSlots([]);
          setSlotError("Couldn't load times. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setSlotsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [providerId, date]);

  function go(next: number) {
    setStep(next);
  }

  function submit() {
    if (!slot) return;
    startTransition(async () => {
      const result = rescheduleId
        ? await rescheduleAppointmentAction({ appointmentId: rescheduleId, startsAt: slot })
        : await bookAppointmentAction({ patientId, providerId, startsAt: slot, reason });
      if (result.ok) {
        toast(rescheduleId ? "Appointment rescheduled." : "Appointment confirmed!", "ok");
        router.push("/my");
      } else {
        toast(result.error ?? "Something went wrong.", "err");
        setSlots([]);
        setSlot("");
        go(2);
      }
    });
  }

  function cancelReschedule() {
    if (!rescheduleId) return;
    startTransition(async () => {
      const result = await cancelAppointmentAction(rescheduleId);
      if (result.ok) {
        toast("Appointment cancelled.", "ok");
        router.push("/my");
      } else {
        toast(result.error ?? "Could not cancel.", "err");
      }
    });
  }

  const steps = ["Reason", "Provider", "Date & time", "Confirm"];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1>{rescheduleId ? "Reschedule appointment" : "Book an appointment"}</h1>
      <p className="muted">
        {rescheduleId
          ? `Picking a new time for ${patientName}'s visit — the new slot is only held once you confirm.`
          : mode === "staff"
            ? `Booking on behalf of ${patientName}.`
            : "Four short steps — about a minute."}
      </p>

      <ol className="wizard-steps" aria-label="Booking progress">
        {steps.map((label, i) => (
          <li
            key={label}
            className={`step ${i === step ? "current" : ""} ${i < step ? "done" : ""}`}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="n">{i < step ? "✓" : i + 1}</span> {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="card card-pad">
          <h2>What brings you in?</h2>
          <div className="reason-grid">
            {REASONS.map((r) => (
              <button
                key={r.label}
                type="button"
                className="reason-option"
                aria-pressed={reason === r.label}
                onClick={() => { setReason(r.label); go(1); }}
              >
                <span className="icon" aria-hidden="true">{r.icon}</span>
                {r.label}
              </button>
            ))}
          </div>
          <div className="field mt-16">
            <label htmlFor="custom-reason">Or describe it in your own words</label>
            <input
              id="custom-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. follow-up on blood test"
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={!reason.trim()} onClick={() => go(1)}>
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="card card-pad">
          <h2>Choose a provider</h2>
          <p className="muted small">All of our providers can help with "{reason}".</p>
          <div className="provider-cards">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                className="provider-option"
                aria-pressed={providerId === p.id}
                onClick={() => { setProviderId(p.id); setDate(""); setSlot(""); go(2); }}
              >
                <span className="avatar">{initials(p.fullName)}</span>
                <span className="meta">
                  <span className="name">{p.fullName}</span>
                  <span className="spec">{p.specialty} · {p.slotMinutes}-min visits</span>
                </span>
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => go(0)}>← Back</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card card-pad">
          <h2>Pick a date & time</h2>
          <p className="muted small">Times shown in clinic time. Only open slots are listed.</p>
          <div className="date-strip">
            {dates.map((d) => {
              const dt = new Date(`${d}T00:00:00`);
              return (
                <button
                  key={d}
                  type="button"
                  className={`date-chip ${date === d ? "selected" : ""}`}
                  aria-pressed={date === d}
                  onClick={() => { setDate(d); setSlot(""); }}
                >
                  <span className="dow">{dt.toLocaleDateString("en-US", { weekday: "short" })}</span>
                  <span className="dom">{dt.getDate()}</span>
                  <span className="avail" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          {date && (
            <div className="mt-16">
              {slotsLoading ? (
                <div className="slot-empty">Loading times…</div>
              ) : slotError ? (
                <div className="slot-empty">{slotError}</div>
              ) : slots.length === 0 ? (
                <div className="slot-empty">
                  No open times with {provider?.fullName} on this date. Try another day.
                </div>
              ) : (
                <div className="slot-grid">
                  {slots.map((s) => (
                    <button
                      key={s.startsAt}
                      type="button"
                      className={`slot-chip ${slot === s.startsAt ? "selected" : ""}`}
                      aria-pressed={slot === s.startsAt}
                      onClick={() => setSlot(s.startsAt)}
                    >
                      {new Date(`${s.startsAt}:00`).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => go(1)}>← Back</button>
            <button className="btn btn-primary" disabled={!slot} onClick={() => go(3)}>
              Review
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card card-pad">
          <h2>Confirm your visit</h2>
          <div className="confirm-card">
            <div className="row"><span className="k">Patient</span><span className="v">{patientName}</span></div>
            <div className="row"><span className="k">Reason</span><span className="v">{reason || "General visit"}</span></div>
            <div className="row"><span className="k">Provider</span><span className="v">{provider?.fullName}</span></div>
            <div className="row">
              <span className="k">When</span>
              <span className="v">
                {slot
                  ? new Date(`${slot.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    }) + " · " + new Date(`${slot}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                  : "—"}
              </span>
            </div>
          </div>
          <p className="small muted mt-16">
            You'll get a confirmation with the clinic address. Need to change plans later?
            You can reschedule or cancel up to 12 hours before your visit.
          </p>
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => go(2)}>← Back</button>
            <button className="btn btn-primary btn-lg" disabled={isPending || !slot} onClick={submit}>
              {isPending ? "Booking…" : rescheduleId ? "Confirm new time" : "Confirm booking"}
            </button>
          </div>
          {rescheduleId && (
            <button className="btn btn-danger btn-sm mt-16" onClick={() => setConfirmOpen(true)}>
              Cancel this appointment entirely
            </button>
          )}
        </section>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Cancel this appointment?"
        body="Your slot will be released for other patients. You can always book again."
        confirmLabel="Yes, cancel it"
        danger
        onConfirm={() => { setConfirmOpen(false); cancelReschedule(); }}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function initials(name: string): string {
  return name
    .replace("Dr. ", "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
