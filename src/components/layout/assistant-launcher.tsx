"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Compass, LifeBuoy, Search, Sparkles } from "lucide-react";
import { href, type RouteKey } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";

const ALTERNATIVES: { label: string; description: string; route: RouteKey; icon: React.ReactNode }[] = [
  { label: "Nouveau à San Pedro ?", description: "Un parcours guidé selon votre situation.", route: "newcomer", icon: <Compass aria-hidden className="h-5 w-5" /> },
  { label: "Rechercher", description: "Annonces, lieux, services, événements.", route: "search", icon: <Search aria-hidden className="h-5 w-5" /> },
  { label: "Guide pratique", description: "Se loger, se déplacer, services essentiels.", route: "guide", icon: <BookOpen aria-hidden className="h-5 w-5" /> },
  { label: "Aide", description: "Questions fréquentes sur la plateforme.", route: "help", icon: <LifeBuoy aria-hidden className="h-5 w-5" /> },
];

/**
 * Accès à l'assistant « Demandez à San Pedro ». Bouton flottant discret
 * (au-dessus de la barre basse sur mobile). Tant que l'IA n'est pas
 * configurée, le panneau le dit clairement et propose les parcours existants :
 * aucune réponse n'est simulée.
 */
export function AssistantLauncher({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Demandez à San Pedro"
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-pill bg-brand-700 text-white shadow-raised transition-colors hover:bg-brand-800 lg:bottom-6 lg:right-6 lg:w-auto lg:px-5"
      >
        <Sparkles aria-hidden className="h-5 w-5" />
        <span className="hidden text-sm font-semibold lg:inline">Demandez à San Pedro</span>
      </button>
      <Modal
        open={open}
        onClose={close}
        variant="sheet"
        title="Demandez à San Pedro"
        description="Un assistant qui répondra à partir des informations vérifiées de la plateforme, en citant ses sources."
      >
        <div className="flex flex-col gap-4">
          {!enabled && (
            <Alert tone="info" title="L’assistant n’est pas encore disponible">
              Il sera activé lorsque les contenus vérifiés seront suffisants. Il ne répondra jamais par une information
              inventée : sans source, il le dira.
            </Alert>
          )}
          <p className="text-sm font-semibold">En attendant, ces parcours répondent déjà à vos questions :</p>
          <ul className="flex flex-col gap-2">
            {ALTERNATIVES.map((item) => (
              <li key={item.route}>
                <Link
                  href={href(item.route)}
                  onClick={close}
                  className="flex min-h-14 items-center gap-3 rounded-card border border-border px-4 py-2 hover:bg-sand-50"
                >
                  <span className="text-brand-700">{item.icon}</span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-sm text-ink-muted">{item.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </>
  );
}
