"use client";

import { useActionState } from "react";
import { ROLE_LABELS, type UserRole } from "@/domain/roles";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Radio, RadioGroup } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { CAMPAIGN_DECISIONS } from "../domain/back-office";
import {
  createSourceAction,
  handleReportAction,
  mergePlacesAction,
  setAccountAction,
  setAiKillSwitchAction,
  setCampaignStatusAction,
  setOrganizationAction,
} from "../server/back-office-actions";

const decisionButton = "inline-flex min-h-11 items-center rounded-control px-4 text-sm font-semibold";
const primary = `${decisionButton} bg-brand-600 text-white hover:bg-brand-700`;
const secondary = `${decisionButton} border border-border-strong bg-surface hover:bg-sand-100`;
const danger = `${decisionButton} bg-danger text-white hover:bg-red-800`;

/** Décision sur un signalement ; la suspension retire le contenu et prévient son auteur. */
export function ReportDecisionForm({ reportId, suspendLabel, reviewing }: { reportId: string; suspendLabel: string | null; reviewing: boolean }) {
  const [state, action] = useActionState(handleReportAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="signalement" value={reportId} />
      <FormStatus state={state} />
      <Field label="Raison de la décision" hint="Obligatoire pour suspendre ou classer sans suite ; transmise à l’auteur en cas de suspension." error={state.fieldErrors?.note}>
        {(props) => <Textarea {...props} name="note" rows={2} maxLength={1000} defaultValue={state.values?.note} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        {suspendLabel && (
          <button type="submit" name="decision" value="suspendre" className={danger}>
            {suspendLabel}
          </button>
        )}
        <button type="submit" name="decision" value="resolu" className={primary}>
          Marquer comme traité
        </button>
        <button type="submit" name="decision" value="sans_suite" className={secondary}>
          Classer sans suite
        </button>
        {!reviewing && (
          <button type="submit" name="decision" value="examen" className={secondary}>
            Prendre en charge
          </button>
        )}
      </div>
    </form>
  );
}

/** Rôle et suspension d'un compte : seuls les rôles attribuables sont proposés (la base vérifie). */
export function AccountForm({ accountId, role, suspended, assignable }: { accountId: string; role: UserRole; suspended: boolean; assignable: readonly UserRole[] }) {
  const [state, action] = useActionState(setAccountAction, INITIAL_FORM_STATE);
  const canChangeRole = assignable.includes(role);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="compte" value={accountId} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        {canChangeRole ? (
          <Field label="Rôle">
            {(props) => (
              <Select {...props} name="role" defaultValue={state.values?.role ?? ""}>
                <option value="">Inchangé ({ROLE_LABELS[role]})</option>
                {assignable
                  .filter((option) => option !== role)
                  .map((option) => (
                    <option key={option} value={option}>
                      {ROLE_LABELS[option]}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : (
          <p className="text-sm text-ink-muted">Rôle « {ROLE_LABELS[role]} » : modifiable par un superadministrateur seulement.</p>
        )}
        <Field label="Sanction">
          {(props) => (
            <Select {...props} name="suspension" defaultValue={state.values?.suspension ?? ""}>
              <option value="">Aucun changement</option>
              {suspended ? <option value="lever">Lever la suspension</option> : <option value="suspendre">Suspendre le compte</option>}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Raison (journalisée)" required error={state.fieldErrors?.raison}>
        {(props) => <Input {...props} name="raison" maxLength={1000} defaultValue={state.values?.raison} />}
      </Field>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Enregistrer la décision
        </SubmitButton>
      </div>
    </form>
  );
}

export function OrganizationForm({ organizationId, suspended }: { organizationId: string; suspended: boolean }) {
  const [state, action] = useActionState(setOrganizationAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="organisation" value={organizationId} />
      <input type="hidden" name="suspension" value={suspended ? "lever" : "suspendre"} />
      <FormStatus state={state} />
      <Field label="Raison (journalisée)" required error={state.fieldErrors?.raison}>
        {(props) => <Input {...props} name="raison" maxLength={1000} defaultValue={state.values?.raison} />}
      </Field>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          {suspended ? "Lever la suspension" : "Suspendre l’organisation"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function MergeForm({ a, b }: { a: { id: string; name: string }; b: { id: string; name: string } }) {
  const [state, action] = useActionState(mergePlacesAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="a" value={a.id} />
      <input type="hidden" name="b" value={b.id} />
      <FormStatus state={state} />
      <RadioGroup legend="Fiche à conserver (l’autre sera archivée et rattachée à celle-ci)">
        <Radio name="conserver" value={a.id} label={a.name} defaultChecked />
        <Radio name="conserver" value={b.id} label={b.name} />
      </RadioGroup>
      {state.fieldErrors?.conserver && <p className="text-sm font-medium text-danger">{state.fieldErrors.conserver}</p>}
      <Field label="Raison de la fusion" required error={state.fieldErrors?.raison}>
        {(props) => <Input {...props} name="raison" maxLength={1000} defaultValue={state.values?.raison} />}
      </Field>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Fusionner
        </SubmitButton>
      </div>
    </form>
  );
}

const SOURCE_KINDS = {
  terrain: "Relevé terrain",
  officiel: "Source officielle",
  partenaire: "Partenaire",
  declaratif: "Déclaration de l’exploitant",
  publication: "Publication (presse, site)",
  autre: "Autre",
} as const;

export function SourceForm() {
  const [state, action] = useActionState(createSourceAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" required error={errors.type}>
          {(props) => (
            <Select {...props} name="type" defaultValue={state.values?.type ?? ""}>
              <option value="">Choisir…</option>
              {Object.entries(SOURCE_KINDS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date de collecte" required error={errors.date}>
          {(props) => <Input {...props} type="date" name="date" defaultValue={state.values?.date} />}
        </Field>
      </div>
      <Field label="Intitulé public" hint="Exemple : « Relevé terrain, quartier Bardot »." required error={errors.titre}>
        {(props) => <Input {...props} name="titre" maxLength={200} defaultValue={state.values?.titre} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Éditeur ou auteur" error={errors.editeur}>
          {(props) => <Input {...props} name="editeur" maxLength={200} defaultValue={state.values?.editeur} />}
        </Field>
        <Field label="Adresse web" error={errors.url}>
          {(props) => <Input {...props} type="url" name="url" defaultValue={state.values?.url} />}
        </Field>
      </div>
      <div>
        <SubmitButton fullWidth={false}>Enregistrer la source</SubmitButton>
      </div>
    </form>
  );
}

export function CampaignForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState(setCampaignStatusAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="campagne" value={campaignId} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Décision">
          {(props) => (
            <Select {...props} name="statut" defaultValue={state.values?.statut ?? "paused"}>
              {Object.entries(CAMPAIGN_DECISIONS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Raison (journalisée)" required error={state.fieldErrors?.raison}>
          {(props) => <Input {...props} name="raison" maxLength={1000} defaultValue={state.values?.raison} />}
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Appliquer
        </SubmitButton>
      </div>
    </form>
  );
}

export function AiKillSwitchForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(setAiKillSwitchAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="etat" value={disabled ? "reactiver" : "couper"} />
      <FormStatus state={state} />
      <Field label="Raison (journalisée)" required error={state.fieldErrors?.raison}>
        {(props) => <Input {...props} name="raison" maxLength={1000} defaultValue={state.values?.raison} />}
      </Field>
      <div>
        <SubmitButton variant={disabled ? "primary" : "danger"} fullWidth={false}>
          {disabled ? "Réactiver l’IA" : "Couper toute l’IA"}
        </SubmitButton>
      </div>
    </form>
  );
}
