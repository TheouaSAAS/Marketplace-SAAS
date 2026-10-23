"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { unsubscribeAction } from "../server/unsubscribe-action";

/** Bouton de confirmation : un lien ouvert par un antivirus ou un aperçu ne désabonne pas. */
export function UnsubscribeForm({ token, label }: { token: string; label: string }) {
  const [state, action] = useActionState(unsubscribeAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="jeton" value={token} />
      <FormStatus state={state} />
      <div>
        <SubmitButton fullWidth={false}>Ne plus recevoir d’e-mails pour « {label} »</SubmitButton>
      </div>
    </form>
  );
}
