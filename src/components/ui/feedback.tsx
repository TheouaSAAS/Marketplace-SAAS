import type { ReactNode } from "react";
import { CircleCheck, Inbox, Info, TriangleAlert, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_STYLES: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: "border-brand-200 bg-info-soft text-brand-900", icon: <Info aria-hidden className="h-5 w-5" /> },
  success: {
    box: "border-lagoon-100 bg-success-soft text-lagoon-700",
    icon: <CircleCheck aria-hidden className="h-5 w-5" />,
  },
  warning: {
    box: "border-yellow-200 bg-warning-soft text-yellow-900",
    icon: <TriangleAlert aria-hidden className="h-5 w-5" />,
  },
  danger: { box: "border-red-200 bg-danger-soft text-red-900", icon: <TriangleAlert aria-hidden className="h-5 w-5" /> },
};

/** Message contextuel dans la page (information, confirmation, avertissement, erreur). */
export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-card border p-4 text-sm", style.box, className)}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Aucun résultat : expliquer pourquoi et proposer une suite. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-sand-100 text-ink-muted">
        {icon ?? <Inbox aria-hidden className="h-6 w-6" />}
      </span>
      <p className="text-base font-bold text-ink">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Échec de chargement : message compréhensible et action de reprise. */
export function ErrorState({
  title = "Le chargement a échoué",
  description = "Vérifiez votre connexion puis réessayez.",
  offline = false,
  action,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  offline?: boolean;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-red-200 bg-danger-soft px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-white text-danger">
        {offline ? <WifiOff aria-hidden className="h-6 w-6" /> : <TriangleAlert aria-hidden className="h-6 w-6" />}
      </span>
      <p className="text-base font-bold text-red-900">{title}</p>
      {description && <p className="max-w-md text-sm text-red-900/80">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
