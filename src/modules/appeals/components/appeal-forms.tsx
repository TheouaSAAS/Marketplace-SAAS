"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import type { AppealTarget } from "../domain/appeals";
import { decideAppealAction, submitAppealAction } from "../server/actions";

/** Contester une décision, replié par défaut sous le motif affiché. */
export function AppealForm({ type, id, back }: { type: AppealTarget; id: string; back: string }) {
  const [state, action] = useActionState(submitAppealAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold underline">Contester cette décision</summary>
      <form action={action} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="retour" value={back} />
        <FormStatus state={state} />
        <Field label="Pourquoi la décision vous paraît-elle injustifiée ?" hint="Une personne de l’équipe relira votre contenu et votre explication." error={state.fieldErrors?.message}>
          {(props) => <Textarea {...props} name="message" rows={3} maxLength={2000} defaultValue={state.values?.message} />}
        </Field>
        <div>
          <SubmitButton variant="secondary" fullWidth={false}>
            Envoyer le recours
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

const button = "inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold";

export function DecideAppealForm({ appealId }: { appealId: string }) {
  const [state, action] = useActionState(decideAppealAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="recours" value={appealId} />
      <FormStatus state={state} />
      <Field label="Raison de la décision (transmise à l’auteur)" error={state.fieldErrors?.note}>
        {(props) => <Textarea {...props} name="note" rows={2} maxLength={1000} defaultValue={state.values?.note} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="accepter" className={`${button} bg-brand-600 text-white hover:bg-brand-700`}>
          Accepter le recours
        </button>
        <button type="submit" name="decision" value="refuser" className={`${button} border border-border-strong bg-surface hover:bg-sand-100`}>
          Refuser le recours
        </button>
      </div>
    </form>
  );
}
