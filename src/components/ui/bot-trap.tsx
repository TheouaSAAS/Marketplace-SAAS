"use client";

import { useEffect, useRef } from "react";
import { BOT_TRAP_FIELDS } from "@/lib/bot-trap";

/**
 * Champs du défi anti-robot, à placer dans un formulaire public. Le champ
 * piège est hors de l'écran, ignoré des lecteurs d'écran et de la tabulation ;
 * l'heure d'affichage est posée une fois la page interactive.
 */
export function BotTrap() {
  const openedAt = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (openedAt.current) openedAt.current.value = String(Date.now());
  }, []);
  return (
    <>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Laissez ce champ vide
          <input type="text" name={BOT_TRAP_FIELDS.honeypot} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input ref={openedAt} type="hidden" name={BOT_TRAP_FIELDS.openedAt} defaultValue="" />
    </>
  );
}
