"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProvider, updateProviderHours, addDayOff } from "@/lib/actions";
import { useToast } from "@/components/toast";

export interface ProviderFormValues {
  fullName: string;
  credentials: string;
  specialty: string;
  email: string;
  phone: string;
  slotMinutes: string;
  bufferMinutes: string;
}

const EMPTY: ProviderFormValues = {
  fullName: "", credentials: "MD", specialty: "", email: "", phone: "",
  slotMinutes: "30", bufferMinutes: "5",
};

export function ProviderEditor({ mode }: { mode: "create" }) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<ProviderFormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");

  function set(key: keyof ProviderFormValues, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    startTransition(async () => {
      const result = await createProvider({
        fullName: values.fullName,
        credentials: values.credentials,
        specialty: values.specialty,
        email: values.email,
        phone: values.phone,
        slotMinutes: Number(values.slotMinutes),
        bufferMinutes: Number(values.bufferMinutes),
      });
      if (result.ok) {
        toast("Provider added.", "ok");
        setValues(EMPTY);
        setErrors({});
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setBanner(result.error ?? "Could not save.");
      }
    });
  }

  const field = (
    key: keyof ProviderFormValues,
    label: string,
    opts: { type?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={`pv-${key}`}>{label}</label>
      <input
        id={`pv-${key}`}
        type={opts.type ?? "text"}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      {errors[key] && <div className="error">⚠ {errors[key]}</div>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {banner && <div className="form-banner error" role="alert">{banner}</div>}
      {field("fullName", "Full name", {})}
      <div className="form-row">
        {field("credentials", "Credentials")}
        {field("specialty", "Specialty")}
      </div>
      <div className="form-row">
        {field("email", "Email")}
        {field("phone", "Phone")}
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pv-slot">Appointment length (min)</label>
          <input
            id="pv-slot" type="number" min={10} max={120} step={5}
            value={values.slotMinutes}
            onChange={(e) => set("slotMinutes", e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="pv-buffer">Buffer between visits (min)</label>
          <input
            id="pv-buffer" type="number" min={0} max={60} step={5}
            value={values.bufferMinutes}
            onChange={(e) => set("bufferMinutes", e.target.value)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={isPending}>
          {isPending ? "Saving…" : "Add provider"}
        </button>
      </div>
    </form>
  );
}

// ---- Weekly hours editor (used on the manage page) ----

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursEditor({
  providerId,
  initialWindows,
  slotMinutes,
  bufferMinutes,
}: {
  providerId: string;
  initialWindows: string[];
  slotMinutes: number;
  bufferMinutes: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [windows, setWindows] = useState<string[]>(initialWindows);
  const [slot, setSlot] = useState(String(slotMinutes));
  const [buffer, setBuffer] = useState(String(bufferMinutes));

  function save() {
    startTransition(async () => {
      const result = await updateProviderHours({
        providerId,
        windows,
        slotMinutes: Number(slot),
        bufferMinutes: Number(buffer),
      });
      if (result.ok) toast("Weekly hours updated.", "ok");
      else toast(result.error ?? "Could not save hours.", "err");
    });
  }

  function markDayOff(date: string) {
    startTransition(async () => {
      const result = await addDayOff({ providerId, date, reason: "Day off" });
      if (result.ok) toast(`Day off set for ${date}.`, "ok");
      else toast(result.error ?? "Could not set day off.", "err");
    });
  }

  return (
    <div className="stack">
      <div className="card card-pad">
        <h2>Weekly hours</h2>
        <p className="muted small">Leave a day blank to keep it closed. Format HH:MM-HH:MM.</p>
        {DOW.map((day, i) => (
          <div className="form-row" key={day} style={{ alignItems: "center" }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label htmlFor={`wd-${i}`}>{day}</label>
              <input
                id={`wd-${i}`}
                placeholder="e.g. 08:30-17:00"
                value={windows[i] ?? ""}
                onChange={(e) =>
                  setWindows((prev) => prev.map((w, j) => (j === i ? e.target.value : w)))
                }
              />
            </div>
          </div>
        ))}
        <div className="form-row">
          <div className="field">
            <label htmlFor="he-slot">Appointment length (min)</label>
            <input id="he-slot" type="number" min={10} max={120} value={slot} onChange={(e) => setSlot(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="he-buffer">Buffer (min)</label>
            <input id="he-buffer" type="number" min={0} max={60} value={buffer} onChange={(e) => setBuffer(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={isPending} onClick={save}>
            {isPending ? "Saving…" : "Save weekly hours"}
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <h2>Mark a day off</h2>
        <p className="muted small">Holidays, training, leave — blocks all slots for that date.</p>
        <div className="form-row">
          <div className="field">
            <label htmlFor="off-date">Date</label>
            <input id="off-date" type="date" onChange={(e) => e.target.value && markDayOff(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}
