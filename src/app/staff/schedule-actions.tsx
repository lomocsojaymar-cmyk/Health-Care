"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAppointmentStatusAction } from "@/lib/actions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/ui";
import type { AppointmentStatus } from "@/lib/types";

export function ScheduleActions({
  appointmentId,
  status,
  startsAt,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  startsAt: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"none" | "noshow" | "cancel">("none");

  function applyStatus(newStatus: "COMPLETED" | "NO_SHOW" | "CANCELLED" | "SCHEDULED") {
    startTransition(async () => {
      const result = await setAppointmentStatusAction(appointmentId, newStatus);
      if (result.ok) toast("Status updated.", "ok");
      else toast(result.error ?? "Could not update.", "err");
    });
  }

  const isPast = new Date(startsAt) < new Date();

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      {status === "SCHEDULED" && isPast && (
        <>
          <button
            className="btn btn-primary btn-sm"
            disabled={isPending}
            onClick={() => applyStatus("COMPLETED")}
          >
            ✓ Done
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={isPending}
            onClick={() => setDialog("noshow")}
          >
            No-show
          </button>
        </>
      )}
      {status === "SCHEDULED" && !isPast && (
        <>
          <Link className="btn btn-ghost btn-sm" href={`/book?reschedule=${appointmentId}`}>
            Reschedule
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            disabled={isPending}
            onClick={() => setDialog("cancel")}
          >
            Cancel
          </button>
        </>
      )}
      {status !== "SCHEDULED" && (
        <button
          className="btn btn-ghost btn-sm"
          disabled={isPending}
          onClick={() => applyStatus("SCHEDULED")}
        >
          ↺ Reinstate
        </button>
      )}

      <ConfirmDialog
        open={dialog === "noshow"}
        title="Mark as no-show?"
        body="The patient will be recorded as a no-show for this visit."
        confirmLabel="Mark no-show"
        danger
        onConfirm={() => { setDialog("none"); applyStatus("NO_SHOW"); }}
        onClose={() => setDialog("none")}
      />
      <ConfirmDialog
        open={dialog === "cancel"}
        title="Cancel this appointment?"
        body="The slot will be released and the patient will need to rebook."
        confirmLabel="Yes, cancel it"
        danger
        onConfirm={() => { setDialog("none"); applyStatus("CANCELLED"); }
        }
        onClose={() => setDialog("none")}
      />
    </span>
  );
}
