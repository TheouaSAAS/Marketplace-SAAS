import type { ComponentProps, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Pastille de filtre à bascule (aria-pressed). Utilisée pour les filtres
 * rapides (catégorie, « aujourd'hui », « gratuit »…). Hauteur 44 px au doigt.
 */
export function FilterChip({
  selected = false,
  icon,
  count,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { selected?: boolean; icon?: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
          : "border-border-strong bg-surface text-ink hover:bg-sand-100",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {count !== undefined && <span className={cn("text-xs", selected ? "text-brand-100" : "text-ink-muted")}>({count})</span>}
    </button>
  );
}

/** Rangée de filtres défilante horizontalement sur mobile, sur plusieurs lignes à partir de la tablette. */
export function FilterBar({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0", className)}
    >
      {children}
    </div>
  );
}

/** Filtre actif retirable (« Quartier : Cité ✕ »). */
export function ActiveFilter({ children, onRemove, className }: { children: ReactNode; onRemove: () => void; className?: string }) {
  return (
    <span className={cn("inline-flex h-9 items-center gap-1 rounded-pill bg-brand-50 pl-3 text-sm font-medium text-brand-800", className)}>
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="flex h-9 w-9 items-center justify-center rounded-pill hover:bg-brand-100"
        aria-label={`Retirer le filtre ${typeof children === "string" ? children : ""}`.trim()}
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </span>
  );
}
