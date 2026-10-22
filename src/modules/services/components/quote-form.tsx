"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { QUOTE_CONSENT, QUOTE_TIMINGS } from "../domain/quote";
import { requestQuoteAction } from "../server/quote-action";

/** Demande de devis structurée ; l'accord de transmission des coordonnées est obligatoire. */
export function QuoteForm({ businessId, back, services }: { businessId: string; back: string; services: string[] }) {
  const [state, action] = useActionState(requestQuoteAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="professionnel" value={businessId} />
      <input type="hidden" name="retour" value={back} />
      <FormStatus state={state} />
      <Field label="Prestation souhaitée" error={errors.prestation}>
        {(props) => <Input {...props} name="prestation" list="prestations" maxLength={120} defaultValue={values.prestation} />}
      </Field>
      <datalist id="prestations">
        {services.map((service) => (
          <option key={service} value={service} />
        ))}
      </datalist>
      <Field label="Délai souhaité" error={errors.quand}>
        {(props) => (
          <Select {...props} name="quand" defaultValue={values.quand ?? "a_definir"}>
            {Object.entries(QUOTE_TIMINGS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Quartier (facultatif)" error={errors.quartier}>
        {(props) => <Input {...props} name="quartier" maxLength={80} defaultValue={values.quartier} />}
      </Field>
      <Field label="Votre besoin" error={errors.message}>
        {(props) => <Textarea {...props} name="message" rows={4} maxLength={3000} defaultValue={values.message} />}
      </Field>
      <Field label="Votre nom" error={errors.nom}>
        {(props) => <Input {...props} name="nom" autoComplete="name" maxLength={80} defaultValue={values.nom} />}
      </Field>
      <Field label="Téléphone" error={errors.telephone} hint="Un téléphone ou un e-mail.">
        {(props) => <Input {...props} name="telephone" type="tel" autoComplete="tel" maxLength={30} defaultValue={values.telephone} />}
      </Field>
      <Field label="E-mail" error={errors.email}>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" defaultValue={values.email} />}
      </Field>
      <Checkbox name="accord" value="1" label={QUOTE_CONSENT} />
      {errors.accord && <p className="text-sm font-medium text-danger">{errors.accord}</p>}
      <SubmitButton>Envoyer la demande de devis</SubmitButton>
      <p className="text-xs text-ink-muted">Connexion requise. Sans votre accord, aucune coordonnée n’est transmise.</p>
    </form>
  );
}
