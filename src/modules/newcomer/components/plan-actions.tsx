"use client";

import { useActionState } from "react";
import { BookmarkCheck, Trash2 } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { deleteNewcomerPlanAction, saveNewcomerPlanAction } from "../server/actions";

/** Enregistrer le plan dans le compte (sans compte : passage par la connexion, puis retour au plan). */
export function SavePlanForm({ query }: { query: string }) {
  const [state, action] = useActionState(saveNewcomerPlanAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="reponses" value={query} />
      <FormStatus state={state} />
      {state.status !== "success" && (
        <SubmitButton fullWidth={false}>
          <BookmarkCheck aria-hidden className="h-4 w-4" />
          Enregistrer dans mon compte
        </SubmitButton>
      )}
    </form>
  );
}

/** Suppression définitive du parcours enregistré, après confirmation du navigateur. */
export function DeletePlanForm({ returnTo }: { returnTo?: "profil" | "tableau-de-bord" }) {
  const [state, action] = useActionState(deleteNewcomerPlanAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Supprimer définitivement votre parcours enregistré ?")) event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      {returnTo && <input type="hidden" name="retour" value={returnTo} />}
      <FormStatus state={state} />
      <Button type="submit" variant="ghost" icon={<Trash2 aria-hidden className="h-4 w-4" />}>
        Supprimer mon parcours enregistré
      </Button>
    </form>
  );
}
