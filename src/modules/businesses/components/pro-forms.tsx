"use client";

import { useActionState } from "react";
import { Star } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import {
  acceptInvitationAction,
  createProPageAction,
  decideVerificationAction,
  moderateProPageAction,
  moderateReviewAction,
  requestVerificationAction,
  respondReviewAction,
  submitProPageAction,
  submitReviewAction,
} from "../server/pro-actions";

const decisionButton = "inline-flex h-11 items-center rounded-control px-4 text-sm font-semibold";
const primary = `${decisionButton} bg-brand-600 text-white hover:bg-brand-700`;
const secondary = `${decisionButton} border border-border-strong bg-surface hover:bg-sand-100`;

export function CreateProPageForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createProPageAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom de l’activité" required error={errors.nom}>
          {(props) => <Input {...props} name="nom" maxLength={120} defaultValue={state.values?.nom} />}
        </Field>
        <Field label="Catégorie" required error={errors.categorie}>
          {(props) => (
            <Select {...props} name="categorie" defaultValue={state.values?.categorie ?? ""}>
              <option value="">Choisir…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <SubmitButton fullWidth={false}>Créer la page</SubmitButton>
    </form>
  );
}

export function SubmitProPageForm({ pageId }: { pageId: string }) {
  const [state, action] = useActionState(submitProPageAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="page" value={pageId} />
      <FormStatus state={state} />
      <SubmitButton fullWidth={false}>Soumettre à la modération</SubmitButton>
    </form>
  );
}

export function VerificationRequestForm({ pageId }: { pageId: string }) {
  const [state, action] = useActionState(requestVerificationAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="page" value={pageId} />
      <FormStatus state={state} />
      <Field label="Élément vérifiable" hint="Numéro RCCM, carte professionnelle, adresse où l’équipe peut passer… Vu par l’équipe locale seulement." error={state.fieldErrors?.preuve}>
        {(props) => <Textarea {...props} name="preuve" rows={2} maxLength={1000} defaultValue={state.values?.preuve} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Demander la vérification
      </SubmitButton>
    </form>
  );
}

export function ReviewForm({ pageId, back }: { pageId: string; back: string }) {
  const [state, action] = useActionState(submitReviewAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="page" value={pageId} />
      <input type="hidden" name="retour" value={back} />
      <FormStatus state={state} />
      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">Votre note</legend>
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((note) => (
            <label key={note} className="inline-flex items-center gap-1 text-sm">
              <input type="radio" name="note" value={note} defaultChecked={state.values?.note === String(note)} />
              {note}
              <Star aria-hidden className="h-4 w-4 fill-accent-400 text-accent-500" />
            </label>
          ))}
        </div>
        {errors.note && <p className="text-sm text-danger">{errors.note}</p>}
      </fieldset>
      <Field label="Votre avis (facultatif)" hint="Votre expérience réelle, sans données personnelles." error={errors.texte}>
        {(props) => <Textarea {...props} name="texte" rows={3} maxLength={3000} defaultValue={state.values?.texte} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Envoyer mon avis
      </SubmitButton>
    </form>
  );
}

export function RespondForm({ pageId, reviewId, current }: { pageId: string; reviewId: string; current: string | null }) {
  const [state, action] = useActionState(respondReviewAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="page" value={pageId} />
      <input type="hidden" name="avis" value={reviewId} />
      <FormStatus state={state} />
      <Field label={current ? "Modifier votre réponse" : "Répondre publiquement"} error={state.fieldErrors?.reponse}>
        {(props) => <Textarea {...props} name="reponse" rows={2} maxLength={2000} defaultValue={state.values?.reponse ?? current ?? ""} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Publier la réponse
      </SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="jeton" value={token} />
      <FormStatus state={state} />
      <SubmitButton fullWidth={false}>Rejoindre l’équipe</SubmitButton>
    </form>
  );
}

export function ProModerationForm({ pageId }: { pageId: string }) {
  const [state, action] = useActionState(moderateProPageAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="page" value={pageId} />
      <FormStatus state={state} />
      <Field label="Motif (obligatoire en cas de refus, transmis au professionnel)" error={state.fieldErrors?.motif}>
        {(props) => <Input {...props} name="motif" maxLength={500} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="publier" className={primary}>
          Publier
        </button>
        <button type="submit" name="decision" value="refuser" className={secondary}>
          Refuser
        </button>
      </div>
    </form>
  );
}

export function VerificationDecisionForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(decideVerificationAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="demande" value={requestId} />
      <FormStatus state={state} />
      <Field label="Source du contrôle (obligatoire pour vérifier)" hint="Document consulté, registre, visite… avec la date si utile.">
        {(props) => <Input {...props} name="source" maxLength={200} />}
      </Field>
      <Field label="Note (motif obligatoire en cas de refus)">
        {(props) => <Input {...props} name="note" maxLength={1000} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="verifier" className={primary}>
          Marquer vérifié
        </button>
        <button type="submit" name="decision" value="refuser" className={secondary}>
          Refuser
        </button>
      </div>
    </form>
  );
}

export function ReviewModerationForm({ reviewId }: { reviewId: string }) {
  const [state, action] = useActionState(moderateReviewAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="avis" value={reviewId} />
      <FormStatus state={state} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="publier" className={primary}>
          Publier
        </button>
        <button type="submit" name="decision" value="refuser" className={secondary}>
          Refuser
        </button>
      </div>
    </form>
  );
}
