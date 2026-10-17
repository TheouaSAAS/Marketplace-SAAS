"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";

type ToastTone = "info" | "success" | "danger";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  notify: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS = 5000;

const ICONS: Record<ToastTone, ReactNode> = {
  info: <Info aria-hidden className="h-5 w-5 text-brand-600" />,
  success: <CircleCheck aria-hidden className="h-5 w-5 text-success" />,
  danger: <TriangleAlert aria-hidden className="h-5 w-5 text-danger" />,
};

/** Notifications éphémères, annoncées aux lecteurs d'écran (région aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "danger" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-border bg-surface p-4 shadow-overlay animate-slide-up"
          >
            {ICONS[toast.tone]}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-ink-muted">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-m-1 rounded-control p-1 text-ink-subtle hover:text-ink"
              aria-label="Fermer la notification"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast doit être utilisé dans un <ToastProvider>.");
  return api;
}
