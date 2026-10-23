"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input } from "@/components/ui/form-controls";
import { Alert } from "@/components/ui/feedback";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { moderateListingAction, submitListingAction, type SubmitState } from "../server/actions";

/** Soumission à la modération ; les manques et motifs bloquants sont listés. */
export function SubmitListingForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState<SubmitState, FormData>(submitListingAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="annonce" value={listingId} />
      {state.status === "error" && (
        <Alert tone="danger" title={state.message}>
          {state.problems && (
            <ul className="list-disc pl-4">
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <SubmitButton fullWidth={false}>Soumettre à la modération</SubmitButton>
      <p className="text-xs text-ink-muted">En soumettant, vous confirmez que l’annonce est exacte et vous appartient. L’équipe la relit avant publication et vous notifie sa décision.</p>
    </form>
  );
}

export function ListingModerationForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState(moderateListingAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="annonce" value={listingId} />
      <FormStatus state={state} />
      <Field label="Motif (obligatoire en cas de refus, transmis à l’auteur)" error={state.fieldErrors?.motif}>
        {(props) => <Input {...props} name="motif" maxLength={500} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="publier" className="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Publier
        </button>
        <button
          type="submit"
          name="decision"
          value="refuser"
          className="inline-flex h-11 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-sand-100"
        >
          Refuser
        </button>
      </div>
    </form>
  );
}
