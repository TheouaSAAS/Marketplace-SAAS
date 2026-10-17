import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Largeur de contenu commune à toutes les pages, avec marges latérales mobiles de 16 px. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
