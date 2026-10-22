import Link from "next/link";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import { REAL_ESTATE_MODE_KEYS, REAL_ESTATE_MODES, type RealEstateMode } from "../domain/modes";

/** Onglets des entrées immobilières (liens : l'entrée fait partie de l'adresse). */
export function ModeNav({ current }: { current: RealEstateMode | null }) {
  return (
    <nav aria-label="Entrées immobilières" className="relative -mx-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex gap-1">
        {REAL_ESTATE_MODE_KEYS.map((mode) => (
          <li key={mode} className="shrink-0">
            <Link
              href={href("realEstateMode", { params: { mode } })}
              aria-current={mode === current ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                mode === current ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {REAL_ESTATE_MODES[mode].label}
            </Link>
          </li>
        ))}
        <li className="shrink-0">
          <Link
            href={href("realEstateAdvice")}
            className="-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Conseils
          </Link>
        </li>
      </ul>
    </nav>
  );
}
