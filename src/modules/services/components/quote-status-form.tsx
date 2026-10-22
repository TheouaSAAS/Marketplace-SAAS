"use client";

import { useActionState, useId } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Select } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { QUOTE_STATUSES, type QuoteStatus } from "../domain/quote";
import { updateQuoteStatusAction } from "../server/quote-status-action";

/** Suivi d'une demande reçue : seul le statut change, jamais son contenu. */
export function QuoteStatusForm({ quoteId, status }: { quoteId: string; status: QuoteStatus }) {
  const [state, action] = useActionState(updateQuoteStatusAction, INITIAL_FORM_STATE);
  const id = useId();
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="demande" value={quoteId} />
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={id} className="text-sm font-medium">
            Statut
          </label>
          <Select id={id} name="statut" defaultValue={status} className="w-44">
            {Object.entries(QUOTE_STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Enregistrer
        </SubmitButton>
      </div>
      <FormStatus state={state} />
    </form>
  );
}
