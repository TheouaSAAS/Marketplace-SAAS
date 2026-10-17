import { cn } from "@/lib/cn";
import { SITE } from "@/config/site";

/** Symbole : une rose des vents (le carrefour, l'orientation du nouvel arrivant) au point central orange. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("h-9 w-9 shrink-0", className)}>
      <rect width="40" height="40" rx="10" className="fill-brand-600" />
      <path d="M20 6.5 23.2 16.8 33.5 20 23.2 23.2 20 33.5 16.8 23.2 6.5 20 16.8 16.8Z" fill="#fff" />
      <circle cx="20" cy="20" r="3" className="fill-accent-500" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex flex-col text-sm font-extrabold leading-[1.05] tracking-tight text-brand-900 sm:text-base">
          <span>Carrefour</span>
          <span className="font-semibold text-brand-600">des Possibles</span>
          <span className="sr-only">{SITE.name}</span>
        </span>
      )}
    </span>
  );
}
