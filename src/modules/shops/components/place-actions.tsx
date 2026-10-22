"use client";

import { useActionState } from "react";
import { Heart, ThumbsUp } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { cn } from "@/lib/cn";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { CLAIM_EVIDENCE_HINT, CLAIMANT_ROLES } from "../domain/claims";
import { claimPlaceAction, contactPlaceAction, togglePlaceFavoriteAction, togglePlaceLikeAction } from "../server/actions";

const ROUND = "inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors disabled:opacity-60";

function Hidden({ placeId, back, active }: { placeId: string; back: string; active?: boolean }) {
  return (
    <>
      <input type="hidden" name="lieu" value={placeId} />
      <input type="hidden" name="retour" value={back} />
      {active !== undefined && <input type="hidden" name="actif" value={active ? "1" : "0"} />}
    </>
  );
}

/** Favori : liste privée. Sans compte, le clic mène à la connexion puis revient ici. */
export function PlaceFavoriteButton({ placeId, active, back }: { placeId: string; active: boolean; back: string }) {
  const [state, action, pending] = useActionState(togglePlaceFavoriteAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <Hidden placeId={placeId} back={back} active={active} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={cn(ROUND, active ? "border-accent-600 bg-accent-50 text-accent-800" : "border-border-strong bg-surface hover:bg-sand-100")}
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

/** « J'aime » : seul le total est public. */
export function PlaceLikeButton({ placeId, liked, count, back }: { placeId: string; liked: boolean; count: number; back: string }) {
  const [state, action, pending] = useActionState(togglePlaceLikeAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <Hidden placeId={placeId} back={back} active={liked} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={liked}
        aria-label={`${liked ? "Je n’aime plus" : "J’aime"} (${count} au total)`}
        className={cn(ROUND, liked ? "border-brand-600 bg-brand-50 text-brand-800" : "border-border-strong bg-surface hover:bg-sand-100")}
      >
        <ThumbsUp aria-hidden className={cn("h-4 w-4", liked && "fill-current")} />
        <span aria-hidden>{count}</span>
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Message à l'exploitant par la messagerie interne. */
export function PlaceMessageForm({ placeId, back }: { placeId: string; back: string }) {
  const [state, action] = useActionState(contactPlaceAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <Hidden placeId={placeId} back={back} />
      <FormStatus state={state} />
      <Field label="Votre message à l’exploitant" error={state.fieldErrors?.message}>
        {(props) => <Textarea {...props} name="message" rows={3} maxLength={4000} defaultValue={state.values?.message} />}
      </Field>
      <SubmitButton>Envoyer par la messagerie</SubmitButton>
      <p className="text-xs text-ink-muted">Connexion requise. Vos coordonnées ne sont pas transmises.</p>
    </form>
  );
}

/** Revendication de la vitrine par son exploitant, examinée par l'équipe locale. */
export function ClaimForm({ placeId, back }: { placeId: string; back: string }) {
  const [state, action] = useActionState(claimPlaceAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <Hidden placeId={placeId} back={back} />
      <FormStatus state={state} />
      <Field label="Votre lien avec ce commerce" error={errors.role}>
        {(props) => (
          <Select {...props} name="role" defaultValue={values.role ?? ""}>
            <option value="" disabled>
              Choisir…
            </option>
            {Object.entries(CLAIMANT_ROLES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Présentez-vous" error={errors.message}>
        {(props) => <Textarea {...props} name="message" rows={3} maxLength={2000} defaultValue={values.message} />}
      </Field>
      <Field label="Élément vérifiable" hint={CLAIM_EVIDENCE_HINT} error={errors.preuve}>
        {(props) => <Input {...props} name="preuve" maxLength={500} defaultValue={values.preuve} />}
      </Field>
      <Field label="Téléphone (pour l’équipe seulement)" error={errors.telephone}>
        {(props) => <Input {...props} name="telephone" type="tel" autoComplete="tel" maxLength={30} defaultValue={values.telephone} />}
      </Field>
      <SubmitButton variant="secondary">Envoyer la demande</SubmitButton>
      <p className="text-xs text-ink-muted">Connexion requise. Ces informations ne sont vues que par l’équipe locale.</p>
    </form>
  );
}
