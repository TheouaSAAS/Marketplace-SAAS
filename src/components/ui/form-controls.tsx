import { useId, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-control border bg-surface px-3 text-base text-ink placeholder:text-ink-subtle " +
  "transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 " +
  "disabled:cursor-not-allowed disabled:bg-sand-100 disabled:text-ink-muted";

function controlClasses(invalid: boolean, className?: string) {
  return cn(CONTROL, invalid ? "border-danger" : "border-border-strong", className);
}

// Taille de police 16 px minimum sur les champs : évite le zoom automatique de Safari iOS.
export function Input({ invalid = false, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input className={controlClasses(invalid, cn("h-11", className))} aria-invalid={invalid || undefined} {...props} />;
}

export function Textarea({
  invalid = false,
  className,
  ...props
}: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={controlClasses(invalid, cn("min-h-28 py-2.5", className))}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ invalid = false, className, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={controlClasses(invalid, cn("h-11 appearance-none bg-no-repeat pr-9", className))}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235c554b' stroke-width='2' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

interface FieldControlProps {
  id: string;
  invalid: boolean;
  "aria-describedby"?: string;
  required?: boolean;
}

/**
 * Associe libellé, aide et message d'erreur à un champ (accessibilité).
 * Le champ est fourni par une fonction qui reçoit les attributs à appliquer :
 *   <Field label="Titre" error={errors.title}>{(p) => <Input name="title" {...p} />}</Field>
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: FieldControlProps) => ReactElement;
}) {
  const id = useId();
  const hintId = hint ? `${id}-aide` : undefined;
  const errorId = error ? `${id}-erreur` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy, required })}
      {hint && !error && (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
