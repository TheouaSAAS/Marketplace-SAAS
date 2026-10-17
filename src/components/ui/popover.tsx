"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Ferme un élément ouvert lors d'un clic extérieur ou de la touche Échap. */
export function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, open, onDismiss]);
}

/**
 * Menu déroulant accessible (motif « disclosure ») : bouton aria-expanded qui
 * ouvre un panneau. Le contenu reçoit `close` pour se refermer après un choix.
 */
export function Popover({
  label,
  active = false,
  align = "start",
  className,
  panelClassName,
  children,
}: {
  label: ReactNode;
  active?: boolean;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold transition-colors hover:bg-sand-100",
          (open || active) && "text-brand-700",
          open && "bg-sand-100",
        )}
      >
        {label}
        <ChevronDown aria-hidden className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className={cn(
          "absolute top-full z-50 mt-2 rounded-card border border-border bg-surface p-2 shadow-overlay animate-fade-in",
          align === "end" ? "right-0" : "left-0",
          panelClassName,
        )}
      >
        {open && children(close)}
      </div>
    </div>
  );
}
