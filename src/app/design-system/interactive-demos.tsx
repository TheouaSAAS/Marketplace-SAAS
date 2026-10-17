"use client";

import { useState } from "react";
import { CalendarDays, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActiveFilter, FilterBar, FilterChip } from "@/components/ui/filter-chip";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/feedback";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";

const QUICK_FILTERS = ["Aujourd’hui", "Ce week-end", "Gratuit", "Vérifié"] as const;

/** Onglets de résultats et filtres rapides (démonstration, aucune donnée réelle). */
export function TabsAndFiltersDemo() {
  const [selected, setSelected] = useState<string[]>(["Ce week-end"]);
  const toggle = (filter: string) =>
    setSelected((current) => (current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]));

  return (
    <div className="flex flex-col gap-4">
      <FilterBar label="Filtres rapides">
        {QUICK_FILTERS.map((filter, index) => (
          <FilterChip
            key={filter}
            selected={selected.includes(filter)}
            onClick={() => toggle(filter)}
            icon={index === 0 ? <Sun aria-hidden className="h-4 w-4" /> : index === 1 ? <CalendarDays aria-hidden className="h-4 w-4" /> : undefined}
          >
            {filter}
          </FilterChip>
        ))}
        <FilterChip disabled>Autour de moi</FilterChip>
      </FilterBar>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((filter) => (
            <ActiveFilter key={filter} onRemove={() => toggle(filter)}>
              {filter}
            </ActiveFilter>
          ))}
        </div>
      )}
      <Tabs
        label="Type de résultat"
        items={[
          { id: "annonces", label: "Annonces", count: 0, content: <EmptyState title="Aucune annonce" description="Élargissez vos critères." /> },
          { id: "lieux", label: "Lieux", count: 0, content: <EmptyState title="Aucun lieu" /> },
          { id: "evenements", label: "Événements", count: 0, content: <EmptyState title="Aucun événement" /> },
          { id: "emploi", label: "Emploi", disabled: true, content: null },
        ]}
      />
    </div>
  );
}

export function InteractiveDemos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { notify } = useToast();

  return (
    <div className="flex flex-wrap items-start gap-3">
      <Button variant="secondary" onClick={() => setDialogOpen(true)}>
        Ouvrir une modale
      </Button>
      <Button variant="secondary" onClick={() => setSheetOpen(true)}>
        Ouvrir un panneau (mobile)
      </Button>
      <Button variant="secondary" onClick={() => notify({ tone: "success", title: "Annonce enregistrée", description: "Elle est en attente de vérification." })}>
        Notification de succès
      </Button>
      <Button variant="secondary" onClick={() => notify({ tone: "danger", title: "Envoi impossible", description: "Vérifiez votre connexion." })}>
        Notification d’erreur
      </Button>
      <Popover label="Menu déroulant">
        {(close) => (
          <ul className="w-48">
            {["Modifier", "Dupliquer", "Archiver"].map((item) => (
              <li key={item}>
                <button type="button" onClick={close} className="flex min-h-11 w-full items-center rounded-control px-3 text-left text-sm hover:bg-sand-100">
                  {item}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Retirer l’annonce ?"
        description="Elle ne sera plus visible. Vous pourrez la republier plus tard."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => setDialogOpen(false)}>
              Retirer
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Exemple de contenu de modale.</p>
      </Modal>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filtres" variant="sheet">
        <p className="text-sm text-ink-muted">Sur mobile, ce panneau s’ancre en bas de l’écran pour rester accessible au pouce.</p>
      </Modal>
    </div>
  );
}
