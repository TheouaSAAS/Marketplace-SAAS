"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, LogIn, Menu, Plus } from "lucide-react";
import { NAV_FAMILIES } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NavItemLink, RouteButton } from "./nav-item-link";

/** Menu mobile et tablette : panneau latéral avec recherche, actions et les trois familles. */
export function MobileNav({ searchSlot, className }: { searchSlot?: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className={className}>
      <Button variant="ghost" size="icon" aria-label="Ouvrir le menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Menu aria-hidden className="h-6 w-6" />
      </Button>
      <Modal open={open} onClose={close} title="Menu" variant="drawer">
        <div className="flex flex-col gap-5">
          {searchSlot}
          <div className="grid grid-cols-2 gap-2">
            <RouteButton route="publish" variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />} onNavigate={close}>
              Publier
            </RouteButton>
            <RouteButton route="login" variant="secondary" icon={<LogIn aria-hidden className="h-4 w-4" />} onNavigate={close}>
              Connexion
            </RouteButton>
          </div>
          <nav aria-label="Navigation principale" className="flex flex-col gap-2">
            {NAV_FAMILIES.map((family, index) => (
              <details key={family.key} open={index === 0} className="group rounded-card border border-border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-bold [&::-webkit-details-marker]:hidden">
                  {family.label}
                  <ChevronDown aria-hidden className="h-5 w-5 text-ink-subtle transition-transform group-open:rotate-180" />
                </summary>
                <ul className="border-t border-border px-2 py-2">
                  {family.links.map((link) => (
                    <li key={link.label}>
                      <NavItemLink
                        link={link}
                        onNavigate={close}
                        className="flex min-h-11 items-center rounded-control px-3 text-[0.9375rem] hover:bg-sand-100"
                      />
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </nav>
        </div>
      </Modal>
    </div>
  );
}
