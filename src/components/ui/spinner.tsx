import { cn } from "@/lib/cn";

const SIZES = { sm: "h-4 w-4 border-2", md: "h-6 w-6 border-2", lg: "h-10 w-10 border-[3px]" } as const;

export function Spinner({
  size = "md",
  label = "Chargement",
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  return (
    <span role="status" className={cn("inline-flex items-center", className)}>
      <span
        aria-hidden="true"
        className={cn("animate-spin rounded-full border-current border-r-transparent", SIZES[size])}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** Bloc de remplacement pendant un chargement, aux dimensions du contenu attendu. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-sand-200", className)} />;
}
