"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { deleteDraftAction } from "@/modules/publishing/server/actions";
import { NOTIFICATION_CATEGORIES, PRIVACY_OPTIONS, type NotificationCategory, type PrivacyOption } from "../domain/dashboard";
import {
  archiveListingAction,
  markNotificationsReadAction,
  renewListingAction,
  savePrivacyAction,
  saveNotificationPrefsAction,
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
        {available ? "Marquer indisponible" : "Marquer disponible"}
      </SubmitButton>
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

export function NotificationPrefsForm({ muted }: { muted: NotificationCategory[] }) {
  const [state, action] = useActionState(saveNotificationPrefsAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      {(Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).map((key) => (
        <div key={key} className="flex flex-col gap-0.5">
          <Checkbox name={key} value="1" label={NOTIFICATION_CATEGORIES[key].label} defaultChecked={!muted.includes(key)} />
          <p className="pl-7 text-xs text-ink-muted">{NOTIFICATION_CATEGORIES[key].explain}</p>
        </div>
      ))}
      <SubmitButton fullWidth={false}>Enregistrer</SubmitButton>
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
