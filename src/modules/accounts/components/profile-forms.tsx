"use client";

import { useActionState, useState } from "react";
import { LogOut, Trash2 } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/choice-controls";
import { Field, Input } from "@/components/ui/form-controls";
import { Modal } from "@/components/ui/modal";
import {
  changeAccountTypeAction,
  deleteAccountAction,
  signOutAction,
  updateMarketingConsentAction,
  updateProfileAction,
} from "../server/actions";
import { FormStatus, SubmitButton } from "./form-parts";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action] = useActionState(updateProfileAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <Field label="Nom affiché" hint="Visible sur vos annonces, avis et messages." error={state.fieldErrors?.displayName} required>
        {(props) => <Input {...props} name="displayName" autoComplete="name" defaultValue={state.values?.displayName ?? displayName} />}
      </Field>
      <SubmitButton fullWidth={false}>Enregistrer</SubmitButton>
    </form>
  );
}

export function AccountTypeForm({ target, label, description }: { target: "professionnel" | "particulier"; label: string; description: string }) {
  const [state, action] = useActionState(changeAccountTypeAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      {state.status !== "success" && (
        <>
          <p className="text-sm text-ink-muted">{description}</p>
          <input type="hidden" name="cible" value={target} />
          <SubmitButton variant="secondary" fullWidth={false}>
            {label}
          </SubmitButton>
        </>
      )}
    </form>
  );
}

export function MarketingConsentForm({ granted }: { granted: boolean }) {
  const [state, action] = useActionState(updateMarketingConsentAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      <Switch
        name="marketingEmail"
        defaultChecked={granted}
        label="Actualités de la plateforme par e-mail"
        description="Vous pouvez changer d’avis à tout moment. Chaque choix est daté et conservé."
      />
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer mon choix
      </SubmitButton>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" icon={<LogOut aria-hidden className="h-4 w-4" />}>
        Se déconnecter
      </Button>
    </form>
  );
}

/** Suppression définitive, protégée par une confirmation saisie (« SUPPRIMER »). */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccountAction, INITIAL_FORM_STATE);
  return (
    <>
      <Button variant="danger" icon={<Trash2 aria-hidden className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer définitivement votre compte ?"
        description="Vos annonces, favoris, messages, avis et fichiers seront supprimés. Cette action est irréversible."
      >
        <form action={action} className="flex flex-col gap-4" noValidate>
          <FormStatus state={state} />
          <Field label="Pour confirmer, saisissez SUPPRIMER" error={state.fieldErrors?.confirmation} required>
            {(props) => <Input {...props} name="confirmation" autoComplete="off" autoCapitalize="characters" />}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <SubmitButton variant="danger" fullWidth={false}>
              Supprimer définitivement
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
