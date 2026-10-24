"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input } from "@/components/ui/form-controls";
import { BotTrap } from "@/components/ui/bot-trap";
import { requestPasswordResetAction, updatePasswordAction } from "../server/actions";
import { FormStatus, PasswordField, SubmitButton } from "./form-parts";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <BotTrap />
      <FormStatus state={state} />
      {state.status !== "success" && (
        <>
          <Field label="Adresse e-mail du compte" error={state.fieldErrors?.email} required>
            {(props) => (
              <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />
            )}
          </Field>
          <SubmitButton>Recevoir le lien</SubmitButton>
        </>
      )}
    </form>
  );
}

export function NewPasswordForm({ submitLabel = "Enregistrer le mot de passe" }: { submitLabel?: string }) {
  const [state, action] = useActionState(updatePasswordAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      {state.status !== "success" && (
        <>
          <PasswordField label="Nouveau mot de passe" autoComplete="new-password" error={state.fieldErrors?.password} showRules />
          <PasswordField
            name="confirmation"
            label="Confirmer le mot de passe"
            autoComplete="new-password"
            error={state.fieldErrors?.confirmation}
          />
          <SubmitButton>{submitLabel}</SubmitButton>
        </>
      )}
    </form>
  );
}
