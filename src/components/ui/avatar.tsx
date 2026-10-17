import { cn } from "@/lib/cn";

const SIZES = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg" } as const;

/** Initiales : « Awa Koné » → « AK », « Boutique » → « BO ». */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

/**
 * Avatar d'une personne ou d'une organisation : image si disponible, sinon
 * initiales. Le nom est toujours fourni pour l'alternative textuelle.
 */
export function Avatar({
  name,
  src,
  size = "md",
  shape = "circle",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** « square » pour les organisations (logos). */
  shape?: "circle" | "square";
  className?: string;
}) {
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-100 font-bold text-brand-800",
    shape === "circle" ? "rounded-pill" : "rounded-control",
    SIZES[size],
    className,
  );
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- image d'avatar de petite taille, origine variable (Storage)
    return <img src={src} alt={name} loading="lazy" className={cn(classes, "object-cover")} />;
  }
  return (
    <span role="img" aria-label={name} className={classes}>
      {initials(name)}
    </span>
  );
}
