"use client";

import { useActionState, useState } from "react";
import { BookmarkPlus, Trash2 } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { deleteSavedSearchAction, saveSearchAction } from "../server/actions";

/**
 * Enregistrer la recherche affichée. Sans compte : passage par la connexion,
 * puis retour à la même recherche. Le nom proposé reprend les critères.
 */
export function SaveSearchForm({ query, suggestedName, signedIn }: { query: string; suggestedName: string; signedIn: boolean }) {
  const [state, action] = useActionState(saveSearchAction, INITIAL_FORM_STATE);
  const [open, setOpen] = useState(false);

  if (state.status === "success") return <FormStatus state={state} />;

  if (!signedIn) {
    return (
      <form action={action}>
        <input type="hidden" name="recherche" value={query} />
        <input type="hidden" name="nom" value={suggestedName} />
        <SubmitButton fullWidth={false} variant="secondary">
          <BookmarkPlus aria-hidden className="h-4 w-4" />
          Enregistrer cette recherche
        </SubmitButton>
      </form>
    );
  }

  if (!open) {
    return (
      <Button variant="secondary" icon={<BookmarkPlus aria-hidden className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Enregistrer cette recherche
      </Button>
    );
  }

  return (
    <form action={action} className="flex w-full max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <input type="hidden" name="recherche" value={query} />
      <FormStatus state={state} />
      <Field label="Nom de la recherche" error={state.fieldErrors?.nom}>
        {(props) => <Input {...props} name="nom" defaultValue={state.values?.nom ?? suggestedName} maxLength={80} autoFocus />}
      </Field>
      <p className="text-xs text-ink-muted">Les alertes par e-mail arriveront avec les notifications ; la recherche est déjà retrouvable dans votre profil.</p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton fullWidth={false}>Enregistrer</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function DeleteSavedSearchForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState(deleteSavedSearchAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <FormStatus state={state} />
      <Button type="submit" variant="ghost" size="icon" aria-label={`Supprimer la recherche « ${name} »`}>
        <Trash2 aria-hidden className="h-4 w-4" />
      </Button>
    </form>
  );
}
