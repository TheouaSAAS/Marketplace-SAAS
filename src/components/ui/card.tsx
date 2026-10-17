import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, interactive = false, ...props }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-card border border-border bg-surface shadow-card",
        interactive && "transition-shadow hover:shadow-raised focus-within:shadow-raised",
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2 p-4 sm:p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-bold leading-snug text-ink", className)} {...props} />;
}
