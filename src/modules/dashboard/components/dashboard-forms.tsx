"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { deleteDraftAction } from "@/modules/publishing/server/actions";
import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_KEYS, PRIVACY_OPTIONS, type ChannelPreferences, type PrivacyOption } from "../domain/dashboard";
import {
  archiveListingAction,
  markNotificationsReadAction,
  renewListingAction,
  savePrivacyAction,
  saveNotificationPrefsAction,
  confirmListingAction,
  setAvailabilityAction,
} from "../server/actions";

/** Action sensible : la personne coche une case de confirmation avant le bouton. */
function Confirmed({ id, label, confirm, action, children }: { id: string; label: string; confirm: string; action: (formData: FormData) => void; children?: React.ReactNode }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-danger underline">{label}</summary>
      <form action={action} className="mt-2 flex flex-col gap-2 rounded-control border border-border p-3">
        <input type="hidden" name="annonce" value={id} />
        <Checkbox name="confirmer" value="1" label={confirm} required />
        {children}
        <SubmitButton variant="danger" fullWidth={false}>
          {label}
        </SubmitButton>
      </form>
    </details>
  );
}

export function ArchiveListingForm({ id }: { id: string }) {
  const [state, action] = useActionState(archiveListingAction, INITIAL_FORM_STATE);
  return (
    <Confirmed id={id} label="Archiver" confirm="Je confirme : l’annonce quitte le site (elle reste dans mon historique)." action={action}>
      <FormStatus state={state} />
    </Confirmed>
  );
}

export function DeleteDraftForm({ id }: { id: string }) {
  return <Confirmed id={id} label="Supprimer le brouillon" confirm="Je confirme la suppression définitive du brouillon et de ses photos." action={deleteDraftAction} />;
}

export function RenewListingForm({ id }: { id: string }) {
  const [state, action] = useActionState(renewListingAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="annonce" value={id} />
      <FormStatus state={state} />
      <SubmitButton variant="secondary" fullWidth={false}>
        Renouveler (nouvelle relecture)
      </SubmitButton>
    </form>
  );
}

export function AvailabilityForm({ id, available }: { id: string; available: boolean }) {
  const [state, action] = useActionState(setAvailabilityAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="annonce" value={id} />
      <input type="hidden" name="dispo" value={available ? "unavailable" : "available"} />
      <FormStatus state={state} />
      <SubmitButton variant="secondary" fullWidth={false}>
        {available ? "Marquer non disponible" : "Marquer disponible"}
      </SubmitButton>
    </form>
  );
}

export function ConfirmListingForm({ id }: { id: string }) {
  const [state, action] = useActionState(confirmListingAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="annonce" value={id} />
      <FormStatus state={state} />
      <SubmitButton fullWidth={false}>Toujours disponible : prolonger</SubmitButton>
    </form>
  );
}

export function PrivacyForm({ values }: { values: Record<PrivacyOption, boolean> }) {
  const [state, action] = useActionState(savePrivacyAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      {(Object.keys(PRIVACY_OPTIONS) as PrivacyOption[]).map((key) => (
        <div key={key} className="flex flex-col gap-0.5">
          <Checkbox name={key} value="1" label={PRIVACY_OPTIONS[key].label} defaultChecked={values[key]} />
          <p className="pl-7 text-xs text-ink-muted">{PRIVACY_OPTIONS[key].explain}</p>
        </div>
      ))}
      <SubmitButton fullWidth={false}>Enregistrer mes choix</SubmitButton>
    </form>
  );
}

export function NotificationPrefsForm({ preferences, emailAvailable }: { preferences: ChannelPreferences; emailAvailable: boolean }) {
  const [state, action] = useActionState(saveNotificationPrefsAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormStatus state={state} />
      <ul className="flex flex-col divide-y divide-border">
        {NOTIFICATION_CATEGORY_KEYS.map((key) => {
          const category = NOTIFICATION_CATEGORIES[key];
          return (
            <li key={key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="font-semibold">{category.label}</p>
                <p className="text-xs text-ink-muted">{category.explain}</p>
              </div>
              <div className="flex shrink-0 gap-4">
                <Checkbox
                  name={`site:${key}`}
                  value="1"
                  label={<span>Site<span className="sr-only"> : {category.label}</span></span>}
                  defaultChecked={preferences.site[key]}
                  disabled={!category.siteMutable}
                />
                <Checkbox
                  name={`email:${key}`}
                  value="1"
                  label={<span>E-mail<span className="sr-only"> : {category.label}</span></span>}
                  defaultChecked={preferences.email[key]}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <Checkbox name="email_off" value="1" label="Ne recevoir aucun e-mail de notification" defaultChecked={preferences.emailOff} />
      {!emailAvailable && <p className="text-xs text-ink-muted">L’envoi d’e-mails n’est pas encore activé sur la plateforme : vos choix s’appliqueront dès son ouverture.</p>}
      <div>
        <SubmitButton fullWidth={false}>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

export function MarkReadForm() {
  const [state, action] = useActionState(markNotificationsReadAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <FormStatus state={state} />
      <SubmitButton variant="secondary" fullWidth={false}>
        Tout marquer comme lu
      </SubmitButton>
    </form>
  );
}
