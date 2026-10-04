"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Toast = { msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: Toast["kind"]) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((msg: string, kind: Toast["kind"] = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          {toast.msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}
