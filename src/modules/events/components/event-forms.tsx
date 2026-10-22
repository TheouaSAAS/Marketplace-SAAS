"use client";

import { useActionState } from "react";
import { Heart } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { changeScheduleAction, contactOrganizerAction, moderateEventAction, proposeEventAction, toggleEventFavoriteAction } from "../server/actions";

/** Favori : liste privée, rappel la veille et avis en cas de report ou d'annulation. */
export function EventFavoriteButton({ eventId, active, back }: { eventId: string; active: boolean; back: string }) {
  const [state, action, pending] = useActionState(toggleEventFavoriteAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="evenement" value={eventId} />
      <input type="hidden" name="retour" value={back} />
      <input type="hidden" name="actif" value={active ? "1" : "0"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors disabled:opacity-60",
          active ? "border-accent-600 bg-accent-50 text-accent-800" : "border-border-strong bg-surface hover:bg-sand-100",
        )}
      >
        <Heart aria-hidden className={cn("h-4 w-4", active && "fill-current")} />
        {active ? "Dans mes favoris" : "Ajouter aux favoris"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function OrganizerMessageForm({ eventId, back }: { eventId: string; back: string }) {
  const [state, action] = useActionState(contactOrganizerAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="evenement" value={eventId} />
      <input type="hidden" name="retour" value={back} />
      <FormStatus state={state} />
      <Field label="Votre message à l’organisateur" error={state.fieldErrors?.message}>
        {(props) => <Textarea {...props} name="message" rows={3} maxLength={4000} defaultValue={state.values?.message} />}
      </Field>
      <SubmitButton>Envoyer par la messagerie</SubmitButton>
      <p className="text-xs text-ink-muted">Connexion requise. Vos coordonnées ne sont pas transmises.</p>
    </form>
  );
}

/** Report ou annulation par l'organisateur ; le motif est affiché sur la fiche. */
export function ScheduleForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(changeScheduleAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="evenement" value={eventId} />
      <FormStatus state={state} />
      <Field label="Changement">
        {(props) => (
          <Select {...props} name="action" defaultValue={state.values?.action ?? "reporter"}>
            <option value="reporter">Reporter à une autre date</option>
            <option value="annuler">Annuler</option>
          </Select>
        )}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nouveau début (en cas de report)" hint="Heure de San Pedro." error={errors.debut}>
          {(props) => <Input {...props} name="debut" type="datetime-local" defaultValue={state.values?.debut} />}
        </Field>
        <Field label="Nouvelle fin (facultatif)" error={errors.fin}>
          {(props) => <Input {...props} name="fin" type="datetime-local" defaultValue={state.values?.fin} />}
        </Field>
      </div>
      <Field label="Motif affiché au public" error={errors.motif}>
        {(props) => <Input {...props} name="motif" maxLength={500} defaultValue={state.values?.motif} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer le changement
      </SubmitButton>
    </form>
  );
}

/** Proposition d'un événement, publiée après modération. */
export function ProposeEventForm({ categories, neighborhoods }: { categories: { id: string; name: string }[]; neighborhoods: { id: string; name: string }[] }) {
  const [state, action] = useActionState(proposeEventAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <Field label="Titre" error={errors.titre}>
        {(props) => <Input {...props} name="titre" maxLength={120} defaultValue={values.titre} />}
      </Field>
      <Field label="Description" error={errors.description}>
        {(props) => <Textarea {...props} name="description" rows={6} maxLength={10000} defaultValue={values.description} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie" error={errors.categorie}>
          {(props) => (
            <Select {...props} name="categorie" defaultValue={values.categorie ?? ""}>
              <option value="">Choisir…</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Organisateur" hint="Nom affiché : association, entreprise, vous-même…" error={errors.organisateur}>
          {(props) => <Input {...props} name="organisateur" maxLength={120} defaultValue={values.organisateur} />}
        </Field>
        <Field label="Début" hint="Heure de San Pedro." error={errors.debut}>
          {(props) => <Input {...props} name="debut" type="datetime-local" defaultValue={values.debut} />}
        </Field>
        <Field label="Fin (facultatif)" error={errors.fin}>
          {(props) => <Input {...props} name="fin" type="datetime-local" defaultValue={values.fin} />}
        </Field>
        <Field label="Quartier (facultatif)">
          {(props) => (
            <Select {...props} name="quartier" defaultValue={values.quartier ?? ""}>
              <option value="">Non précisé</option>
              {neighborhoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Lieu ou adresse (facultatif)" error={errors.adresse}>
          {(props) => <Input {...props} name="adresse" maxLength={200} defaultValue={values.adresse} />}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Tarif</legend>
        <Checkbox name="gratuit" value="1" defaultChecked={values.gratuit === "1"} label="Entrée gratuite" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prix minimum (FCFA, facultatif)" error={errors.prix_min}>
            {(props) => <Input {...props} name="prix_min" inputMode="numeric" pattern="[0-9]*" defaultValue={values.prix_min} />}
          </Field>
          <Field label="Prix maximum (FCFA, facultatif)" error={errors.prix_max}>
            {(props) => <Input {...props} name="prix_max" inputMode="numeric" pattern="[0-9]*" defaultValue={values.prix_max} />}
          </Field>
        </div>
        <Field label="Billetterie en ligne (facultatif)" error={errors.billetterie}>
          {(props) => <Input {...props} name="billetterie" type="url" defaultValue={values.billetterie} />}
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Contact public (facultatif)</legend>
        <p className="text-xs text-ink-muted">Affiché sur la fiche. Sans contact public, le public vous écrit par la messagerie.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone" error={errors.telephone}>
            {(props) => <Input {...props} name="telephone" type="tel" maxLength={30} defaultValue={values.telephone} />}
          </Field>
          <Field label="E-mail" error={errors.email}>
            {(props) => <Input {...props} name="email" type="email" defaultValue={values.email} />}
          </Field>
        </div>
      </fieldset>
      <SubmitButton fullWidth={false}>Proposer l’événement</SubmitButton>
      <p className="text-xs text-ink-muted">L’événement sera publié après vérification par l’équipe de modération ; vous serez notifié de la décision.</p>
    </form>
  );
}

export function ModerationForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(moderateEventAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="evenement" value={eventId} />
      <FormStatus state={state} />
      <Field label="Motif (obligatoire en cas de refus, transmis à l’organisateur)" error={state.fieldErrors?.motif}>
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
