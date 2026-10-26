"use client";

import { useActionState, useEffect, useState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input } from "@/components/ui/form-controls";
import { resendConfirmationAction } from "../server/actions";
import { FormStatus, SubmitButton } from "./form-parts";

/** Délai avant un nouveau renvoi (le serveur limite en plus à 3 envois par heure et par adresse). */
const COOLDOWN_SECONDS = 60;

/**
 * Renvoi de l'e-mail de confirmation. Avec `email`, l'adresse est déjà connue
 * (après l'inscription ou une connexion refusée) ; sinon, elle est demandée.
 */
export function ResendConfirmation({ email, startCoolingDown = false }: { email?: string; startCoolingDown?: boolean }) {
  const [state, action] = useActionState(resendConfirmationAction, INITIAL_FORM_STATE);
  const [remaining, setRemaining] = useState(startCoolingDown ? COOLDOWN_SECONDS : 0);

  // Chaque envoi réussi relance le délai.
  const [sentAt, setSentAt] = useState<typeof state | null>(null);
  if (state.status === "success" && sentAt !== state) {
    setSentAt(state);
    setRemaining(COOLDOWN_SECONDS);
  }

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining]);

  return (
    <form action={action} className="flex w-full flex-col gap-3">
      <FormStatus state={state} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <Field label="Adresse e-mail du compte" error={state.fieldErrors?.email} required>
          {(props) => <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />}
        </Field>
      )}
      <SubmitButton variant="secondary" disabled={remaining > 0}>
        {remaining > 0 ? `Renvoyer l’e-mail (possible dans ${remaining} s)` : "Renvoyer l’e-mail de confirmation"}
      </SubmitButton>
    </form>
  );
}
