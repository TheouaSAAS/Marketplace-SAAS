"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { href } from "@/config/routes";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox, Radio, RadioGroup } from "@/components/ui/choice-controls";
import { Field, Input } from "@/components/ui/form-controls";
import { signUpAction } from "../server/actions";
import { FormStatus, PasswordField, SubmitButton } from "./form-parts";

export function SignupForm() {
  const [state, action] = useActionState(signUpAction, INITIAL_FORM_STATE);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-success-soft text-success">
          <MailCheck aria-hidden className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold">Vérifiez votre boîte e-mail</h2>
        <p className="text-sm text-ink-muted">{state.message}</p>
        <p className="text-xs text-ink-subtle">Pensez à regarder dans les courriers indésirables.</p>
      </div>
    );
  }

  const intent = state.values?.accountIntent ?? "particulier";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <Field label="Votre nom" hint="Affiché sur vos annonces et vos messages." error={state.fieldErrors?.displayName} required>
        {(props) => <Input {...props} name="displayName" autoComplete="name" defaultValue={state.values?.displayName} />}
      </Field>
      <Field label="Adresse e-mail" error={state.fieldErrors?.email} required>
        {(props) => (
          <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />
        )}
      </Field>
      <PasswordField autoComplete="new-password" error={state.fieldErrors?.password} showRules />

      <RadioGroup legend="Vous êtes">
        <Radio
          name="accountIntent"
          value="particulier"
          defaultChecked={intent === "particulier"}
          label="Un particulier"
          description="Publier, contacter, enregistrer des favoris."
        />
        <Radio
          name="accountIntent"
          value="professionnel"
          defaultChecked={intent === "professionnel"}
          label="Un professionnel"
          description="Commerce, artisan, agence… Votre page publique sera visible après modération."
        />
      </RadioGroup>

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <Checkbox
          name="acceptTerms"
          defaultChecked={state.values?.acceptTerms === "on"}
          aria-invalid={Boolean(state.fieldErrors?.acceptTerms) || undefined}
          label={
            <>
              J’accepte les{" "}
              <Link href={href("terms")} target="_blank" className="font-semibold text-brand-700 underline">
                conditions d’utilisation
              </Link>{" "}
              et la{" "}
              <Link href={href("privacy")} target="_blank" className="font-semibold text-brand-700 underline">
                politique de confidentialité
              </Link>
              .
            </>
          }
        />
        {state.fieldErrors?.acceptTerms && <p className="text-sm font-medium text-danger">{state.fieldErrors.acceptTerms}</p>}
        <Checkbox
          name="marketingEmail"
          defaultChecked={state.values?.marketingEmail === "on"}
          label="Recevoir les actualités de la plateforme par e-mail (facultatif)"
        />
      </div>

      <SubmitButton variant="accent">Créer mon compte</SubmitButton>
    </form>
  );
}
