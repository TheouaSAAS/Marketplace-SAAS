"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Textarea } from "@/components/ui/form-controls";
import { FormStatus } from "@/modules/accounts/components/form-parts";
import { reviewClaimAction } from "../server/claim-review-action";

/** Valider ou refuser (motif obligatoire pour un refus, transmis au demandeur). */
export function ClaimReviewForm({ claimId, kind = "lieu" }: { claimId: string; kind?: "lieu" | "pro" }) {
  const [state, action] = useActionState(reviewClaimAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="demande" value={claimId} />
      <input type="hidden" name="cible" value={kind} />
      <FormStatus state={state} />
      <Field label="Motif (obligatoire en cas de refus, transmis au demandeur)">
        {(props) => <Textarea {...props} name="motif" rows={2} maxLength={1000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="valider"
          className="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Valider
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
