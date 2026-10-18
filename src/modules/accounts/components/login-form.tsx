"use client";

import Link from "next/link";
import { useActionState } from "react";
import { href } from "@/config/routes";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input } from "@/components/ui/form-controls";
import { signInAction } from "../server/actions";
import { FormStatus, PasswordField, SubmitButton } from "./form-parts";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, INITIAL_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="suivant" value={next} />
      <Field label="Adresse e-mail" error={state.fieldErrors?.email} required>
        {(props) => (
          <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />
        )}
      </Field>
      <PasswordField autoComplete="current-password" error={state.fieldErrors?.password} />
      <Link href={href("forgotPassword")} className="-mt-1 self-end text-sm font-semibold text-brand-700 hover:underline">
        Mot de passe oublié ?
      </Link>
      <SubmitButton>Se connecter</SubmitButton>
    </form>
  );
}
