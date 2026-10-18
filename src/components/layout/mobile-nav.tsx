"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronDown, Compass, Menu, Plus } from "lucide-react";
import { NAV_SECTIONS, NEWCOMER_LINK } from "@/config/navigation";
import { href } from "@/config/routes";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NavItemLink, RouteButton } from "./nav-item-link";

/** Menu mobile et tablette : panneau latéral avec recherche, accès signature, actions et rubriques. */
export function MobileNav({
  searchSlot,
  accountSlot,
  className,
}: {
  searchSlot?: ReactNode;
  /** Entrée de compte (Connexion ou Mon profil), rendue côté serveur. */
  accountSlot?: ReactNode;
  className?: string;
}) {
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
          <Link
            href={href(NEWCOMER_LINK.route)}
            onClick={close}
            className="flex min-h-12 items-center gap-3 rounded-card bg-accent-50 px-4 font-bold text-accent-700 hover:bg-accent-100"
          >
            <Compass aria-hidden className="h-5 w-5" />
            {NEWCOMER_LINK.label}
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <RouteButton route="publish" variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />} onNavigate={close}>
              Publier
            </RouteButton>
            {/* Un clic dans la zone (lien Connexion ou Mon profil) referme le menu. */}
            <div onClickCapture={close}>{accountSlot}</div>
          </div>
          <nav aria-label="Rubriques" className="flex flex-col gap-2">
            {NAV_SECTIONS.map((section, index) => (
              <details key={section.key} open={index === 0} className="group rounded-card border border-border">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-bold [&::-webkit-details-marker]:hidden">
                  {section.label}
                  <ChevronDown aria-hidden className="h-5 w-5 text-ink-subtle transition-transform group-open:rotate-180" />
                </summary>
                <ul className="border-t border-border px-2 py-2">
                  {section.links.map((link) => (
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
