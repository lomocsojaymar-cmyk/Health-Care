"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivatePatient, reactivatePatient } from "@/lib/actions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/ui";
import type { EntityStatus } from "@/lib/types";

export function DeactivateControls({
  patientId,
  status,
}: {
  patientId: string;
  status: EntityStatus;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function deactivate() {
    startTransition(async () => {
      const result = await deactivatePatient(patientId, "staff:Front Desk");
      if (result.ok) {
        toast("Patient deactivated. Upcoming visits cancelled.", "ok");
        router.refresh();
      } else {
        toast(result.error ?? "Could not deactivate.", "err");
      }
    });
  }

  function reactivate() {
    startTransition(async () => {
      const result = await reactivatePatient(patientId);
      if (result.ok) {
        toast("Patient reactivated.", "ok");
        router.refresh();
      } else {
        toast(result.error ?? "Could not reactivate.", "err");
      }
    });
  }

  return (
    <>
      {status === "ACTIVE" ? (
        <button className="btn btn-danger btn-sm" disabled={isPending} onClick={() => setOpen(true)}>
          Deactivate account
        </button>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={isPending} onClick={reactivate}>
          Reactivate account
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Deactivate this patient?"
        body="Their profile and history are kept, they disappear from search, and any upcoming appointments are cancelled. Use this for patients who move away or ask to be removed."
        confirmLabel="Deactivate"
        danger
        onConfirm={() => { setOpen(false); deactivate(); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
