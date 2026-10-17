import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Cases à cocher, boutons radio et interrupteur fondés sur les éléments natifs :
 * clavier, formulaires et lecteurs d'écran fonctionnent sans JavaScript.
 * Zone cliquable ≥ 44 px grâce au libellé englobant.
 */

const LABEL = "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

export function Checkbox({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn(LABEL, className)}>
      <input type="checkbox" className="h-5 w-5 shrink-0 cursor-pointer rounded accent-brand-600" {...props} />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

export function Radio({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn(LABEL, className)}>
      <input type="radio" className="h-5 w-5 shrink-0 cursor-pointer accent-brand-600" {...props} />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
    </label>
  );
}

/** Groupe de boutons radio avec légende (fieldset accessible). */
export function RadioGroup({ legend, children, className }: { legend: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("flex flex-col", className)}>
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** Interrupteur on/off : case à cocher native avec rôle « switch ». */
export function Switch({
  label,
  description,
  className,
  ...props
}: Omit<ComponentProps<"input">, "type" | "role"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn(LABEL, "justify-between", className)}>
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description && <span className="text-xs text-ink-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span
          aria-hidden="true"
          className="h-7 w-12 rounded-pill bg-sand-300 transition-colors peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
        />
        <span
          aria-hidden="true"
          className="absolute left-1 top-1 h-5 w-5 rounded-pill bg-white shadow-card transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}
