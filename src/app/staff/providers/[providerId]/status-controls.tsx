"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateProvider, reactivateProvider } from "@/lib/actions";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/ui";
import type { EntityStatus } from "@/lib/types";

export function ProviderStatusControls({
  providerId,
  status,
}: {
  providerId: string;
  status: EntityStatus;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function deactivate() {
    startTransition(async () => {
      const result = await deactivateProvider(providerId);
      if (result.ok) {
        toast("Provider removed from the active roster.", "ok");
        router.refresh();
      } else {
        toast(result.error ?? "Could not deactivate.", "err");
      }
    });
  }

  function reactivate() {
    startTransition(async () => {
      const result = await reactivateProvider(providerId);
      if (result.ok) {
        toast("Provider restored.", "ok");
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
          Remove from roster
        </button>
      ) : (
        <button className="btn btn-secondary btn-sm" disabled={isPending} onClick={reactivate}>
          Restore to roster
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Remove this provider?"
        body="They stop appearing in booking flows and their weekly hours are paused. Their appointment history is preserved."
        confirmLabel="Remove from roster"
        danger
        onConfirm={() => { setOpen(false); deactivate(); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
