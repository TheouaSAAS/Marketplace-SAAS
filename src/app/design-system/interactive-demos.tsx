"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Popover } from "@/components/ui/popover";
import { useToast } from "@/components/ui/toast";

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
