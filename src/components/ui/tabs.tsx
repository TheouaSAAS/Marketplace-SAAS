"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Nombre affiché à côté du libellé (ex. résultats par type). */
  count?: number;
  content: ReactNode;
  disabled?: boolean;
}

/**
 * Onglets accessibles (motif WAI-ARIA « tabs ») : flèches gauche/droite,
 * Début/Fin, activation automatique. Défilement horizontal sur mobile.
 * Contrôlé (`value` + `onChange`) ou non contrôlé (`defaultValue`).
 */
export function Tabs({
  items,
  label,
  value,
  defaultValue,
  onChange,
  className,
}: {
  items: TabItem[];
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  className?: string;
}) {
  const baseId = useId();
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.id);
  const active = value ?? internal;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const enabled = items.filter((item) => !item.disabled);

  const select = (id: string) => {
    setInternal(id);
    onChange?.(id);
    tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = enabled.findIndex((item) => item.id === active);
    const target =
      event.key === "ArrowRight"
        ? enabled[(index + 1) % enabled.length]
        : event.key === "ArrowLeft"
          ? enabled[(index - 1 + enabled.length) % enabled.length]
          : event.key === "Home"
            ? enabled[0]
            : event.key === "End"
              ? enabled[enabled.length - 1]
              : undefined;
    if (target) {
      event.preventDefault();
      select(target.id);
    }
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-onglet-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panneau-${item.id}`}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              className={cn(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-brand-600 text-brand-700" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={cn("rounded-pill px-2 text-xs", selected ? "bg-brand-50 text-brand-700" : "bg-sand-100")}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panneau-${item.id}`}
          aria-labelledby={`${baseId}-onglet-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="focus-visible:rounded-control"
        >
          {item.id === active && item.content}
        </div>
      ))}
    </div>
  );
}
