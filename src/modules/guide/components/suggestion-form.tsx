"use client";

import { useActionState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { suggestCorrectionAction } from "../server/actions";

/** Suggérer une correction : examinée par l'équipe locale, jamais publiée telle quelle. */
export function SuggestionForm({ articleId, back }: { articleId: string; back: string }) {
  const [state, action] = useActionState(suggestCorrectionAction, INITIAL_FORM_STATE);
  return (
    <details className="rounded-card border border-border bg-surface p-4">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        <MessageSquarePlus aria-hidden className="h-4 w-4" />
        Suggérer une correction
      </summary>
      {state.status === "success" ? (
        <div className="mt-3">
          <FormStatus state={state} />
        </div>
      ) : (
        <form action={action} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="article" value={articleId} />
          <input type="hidden" name="retour" value={back} />
          <FormStatus state={state} />
          <Field
            label="Ce qui est inexact ou a changé"
            hint="Indiquez si possible votre source (affichage, site officiel, constat sur place)."
            error={state.fieldErrors?.message}
          >
            {(props) => <Textarea {...props} name="message" rows={4} maxLength={3000} defaultValue={state.values?.message} />}
          </Field>
          <SubmitButton variant="secondary" fullWidth={false}>
            Envoyer la suggestion
          </SubmitButton>
          <p className="text-xs text-ink-muted">Connexion requise. Votre nom n’est pas publié.</p>
        </form>
      )}
    </details>
  );
}
