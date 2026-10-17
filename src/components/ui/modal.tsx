"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Fenêtre modale fondée sur l'élément natif <dialog> : piège du focus, touche
 * Échap et couche d'arrière-plan sont gérés par le navigateur.
 * Variante « sheet » : panneau ancré en bas sur mobile (filtres, résumé de carte),
 * centré à partir de la tablette. Variante « drawer » : panneau latéral (menu mobile).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "dialog",
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "dialog" | "sheet" | "drawer";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sur l'arrière-plan cible le <dialog> lui-même : on ferme.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "max-h-[100dvh] bg-surface p-0 text-ink shadow-overlay open:animate-slide-up",
        variant === "dialog" && "m-auto w-[calc(100%-2rem)] max-w-lg rounded-card",
        variant === "sheet" &&
          "mx-0 mb-0 mt-auto w-full max-w-none rounded-t-card sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:rounded-card",
        variant === "drawer" && "my-0 ml-auto mr-0 h-[100dvh] w-[min(22rem,100%)] max-w-none rounded-none",
        className,
      )}
    >
      <div className={cn("flex max-h-[inherit] flex-col", variant === "drawer" && "h-full")}>
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 -mt-1 flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:bg-sand-100"
            aria-label="Fermer"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}
