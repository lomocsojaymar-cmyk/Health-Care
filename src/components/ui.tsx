"use client";

import { useEffect, useRef } from "react";
import type { AppointmentStatus, EntityStatus } from "@/lib/types";

const STATUS_META: Record<AppointmentStatus, { label: string; cls: string; icon: string }> = {
  SCHEDULED: { label: "Scheduled", cls: "badge-scheduled", icon: "•" },
  COMPLETED: { label: "Completed", cls: "badge-completed", icon: "✓" },
  CANCELLED: { label: "Cancelled", cls: "badge-cancelled", icon: "—" },
  NO_SHOW: { label: "No-show", cls: "badge-noshow", icon: "!" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`badge ${meta.cls}`}>
      <span className="dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function EntityBadge({ status }: { status: EntityStatus }) {
  return (
    <span className={`badge ${status === "ACTIVE" ? "badge-active" : "badge-inactive"}`}>
      <span className="dot" aria-hidden="true" />
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <h2>{title}</h2>
        <p className="muted">{body}</p>
        <div className="form-actions">
          <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>Keep as is</button>
        </div>
      </div>
    </div>
  );
}
