"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPatient, updatePatient } from "@/lib/actions";
import { useToast } from "@/components/toast";
import type { Patient } from "@/lib/types";

export interface PatientFormValues {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  addressLine: string;
  city: string;
  postcode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

const EMPTY: PatientFormValues = {
  firstName: "", lastName: "", dateOfBirth: "", phone: "", email: "",
  addressLine: "", city: "", postcode: "", emergencyContactName: "", emergencyContactPhone: "",
};

export function PatientForm({ existing }: { existing?: Patient }) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<PatientFormValues>(
    existing
      ? {
          firstName: existing.firstName,
          lastName: existing.lastName,
          dateOfBirth: existing.dateOfBirth,
          phone: existing.phone,
          email: existing.email,
          addressLine: existing.addressLine,
          city: existing.city,
          postcode: existing.postcode,
          emergencyContactName: existing.emergencyContactName,
          emergencyContactPhone: existing.emergencyContactPhone,
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState("");

  function set<K extends keyof PatientFormValues>(key: K, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner("");
    startTransition(async () => {
      const result = existing
        ? await updatePatient(existing.id, values)
        : await createPatient(values);
      if (result.ok) {
        toast(existing ? "Patient updated." : "Patient registered.", "ok");
        if (!existing) setValues(EMPTY);
        setErrors({});
        router.refresh();
      } else {
        setErrors(result.fieldErrors ?? {});
        setBanner(result.error ?? "Could not save.");
      }
    });
  }

  const field = (
    key: keyof PatientFormValues,
    label: string,
    opts: { type?: string; hint?: string } = {},
  ) => (
    <div className="field">
      <label htmlFor={`pf-${key}`}>{label}</label>
      <input
        id={`pf-${key}`}
        type={opts.type ?? "text"}
        value={values[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={!!errors[key]}
      />
      {opts.hint && <div className="hint">{opts.hint}</div>}
      {errors[key] && <div className="error">⚠ {errors[key]}</div>}
    </div>
  );

  return (
    <form onSubmit={submit} noValidate>
      {banner && <div className="form-banner error" role="alert">{banner}</div>}
      <div className="form-row">
        {field("firstName", "First name")}
        {field("lastName", "Last name")}
      </div>
      <div className="form-row">
        {field("dateOfBirth", "Date of birth", { type: "date" })}
        {field("phone", "Phone")}
      </div>
      {field("email", "Email", { hint: "Optional — used for reminders" })}
      {field("addressLine", "Street address")}
      <div className="form-row">
        {field("city", "City")}
        {field("postcode", "Postcode")}
      </div>
      <div className="form-row">
        {field("emergencyContactName", "Emergency contact — name")}
        {field("emergencyContactPhone", "Emergency contact — phone")}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={isPending}>
          {isPending ? "Saving…" : existing ? "Save changes" : "Register patient"}
        </button>
      </div>
    </form>
  );
}
