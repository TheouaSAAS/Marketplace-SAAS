"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { CABIN_SERVICES, STATUS_META, type CabinService, type CabinStatus } from "../domain/cabin";
import {
  createCabinOfferAction,
  reconcileCabinOperationAction,
  saveCabinProviderAction,
  toggleCabinNetworkAction,
  toggleCabinOfferAction,
  updateCabinRouteAction,
  updateCabinServiceAction,
} from "../server/admin-actions";

const SERVICE_LABELS: Record<CabinService, string> = {
  airtime: "Crédit téléphonique",
  airtime_transfer: "Transfert d’unités",
  data: "Offres Internet",
  electricity: "Recharge CIE",
  money_transfer: "Transfert entre réseaux",
};

type ProviderOption = { code: string; name: string };

export function ServiceForm({
  service,
  label,
  enabled,
  feeBps,
  min,
  max,
  provider,
  providers,
}: {
  service: CabinService;
  label: string;
  enabled: boolean;
  feeBps: number;
  min: number;
  max: number;
  provider: string | null;
  providers: ProviderOption[];
}) {
  const [state, action] = useActionState(updateCabinServiceAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="service" value={service} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Frais de service (%)" hint="0,5 par défaut." error={errors.taux}>
          {(props) => <Input {...props} name="taux" inputMode="decimal" defaultValue={String(feeBps / 100).replace(".", ",")} />}
        </Field>
        <Field label="Minimum (F CFA)" error={errors.minimum}>
          {(props) => <Input {...props} name="minimum" inputMode="numeric" defaultValue={min} />}
        </Field>
        <Field label="Maximum (F CFA)" error={errors.maximum}>
          {(props) => <Input {...props} name="maximum" inputMode="numeric" defaultValue={max} />}
        </Field>
        <Field label="Prestataire">
          {(props) => (
            <Select {...props} name="prestataire" defaultValue={provider ?? ""}>
              <option value="">Aucun (démonstration)</option>
              {providers.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Checkbox name="actif" value="1" defaultChecked={enabled} label={`${label} proposé aux visiteurs`} description="Décoché : affiché comme suspendu, aucune opération possible." />
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Enregistrer
        </SubmitButton>
      </div>
    </form>
  );
}

export function ProviderForm({
  provider,
}: {
  provider?: { code: string; name: string; description: string | null; services: CabinService[]; mode: "demo" | "live"; is_active: boolean };
}) {
  const [state, action] = useActionState(saveCabinProviderAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Identifiant" hint="Celui de son intégration dans le code." error={errors.code}>
          {(props) => <Input {...props} name="code" defaultValue={provider?.code ?? state.values?.code} readOnly={Boolean(provider)} maxLength={40} />}
        </Field>
        <Field label="Nom" error={errors.nom}>
          {(props) => <Input {...props} name="nom" defaultValue={provider?.name ?? state.values?.nom} maxLength={80} />}
        </Field>
        <Field label="Mode">
          {(props) => (
            <Select {...props} name="mode" defaultValue={provider?.mode ?? "demo"}>
              <option value="demo">Démonstration</option>
              <option value="live">Réel (intégration et clés requises)</option>
            </Select>
          )}
        </Field>
      </div>
      <Field label="Description (contrat, agrément, contact)" error={errors.description}>
        {(props) => <Input {...props} name="description" defaultValue={provider?.description ?? state.values?.description} maxLength={500} />}
      </Field>
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-semibold">Services couverts par le contrat</legend>
        <div className="grid sm:grid-cols-3">
          {CABIN_SERVICES.map((service) => (
            <Checkbox key={service} name="services" value={service} defaultChecked={provider?.services.includes(service)} label={SERVICE_LABELS[service]} />
          ))}
        </div>
      </fieldset>
      <Checkbox name="actif" value="1" defaultChecked={provider?.is_active ?? false} label="Actif" description="Décoché : prestataire suspendu, ses services repassent en démonstration." />
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          {provider ? "Enregistrer" : "Ajouter le prestataire"}
        </SubmitButton>
      </div>
    </form>
  );
}

export function NetworkToggle({ code, name, active }: { code: string; name: string; active: boolean }) {
  const [state, action] = useActionState(toggleCabinNetworkAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="reseau" value={code} />
      <input type="hidden" name="actif" value={active ? "0" : "1"} />
      <FormStatus state={state} />
      <SubmitButton variant="secondary" fullWidth={false}>
        {active ? `Suspendre ${name}` : `Réactiver ${name}`}
      </SubmitButton>
    </form>
  );
}

export function RouteForm({ source, target, provider, enabled, providers }: { source: string; target: string; provider: string | null; enabled: boolean; providers: ProviderOption[] }) {
  const [state, action] = useActionState(updateCabinRouteAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="cible" value={target} />
      <Field label="Prestataire" className="min-w-40 flex-1">
        {(props) => (
          <Select {...props} name="prestataire" defaultValue={provider ?? ""}>
            <option value="">Aucun</option>
            {providers.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Checkbox name="actif" value="1" defaultChecked={enabled} label="Activée" />
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer
      </SubmitButton>
      <FormStatus state={state} />
    </form>
  );
}

export function OfferForm({ networks }: { networks: { code: string; name: string }[] }) {
  const [state, action] = useActionState(createCabinOfferAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.status === "success" ? {} : (state.values ?? {});
  return (
    <form key={state.status === "success" ? state.message : "offre"} action={action} className="flex flex-col gap-3">
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Réseau">
          {(props) => (
            <Select {...props} name="reseau" defaultValue={values.reseau ?? networks[0]?.code}>
              {networks.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nom de l’offre" error={errors.nom}>
          {(props) => <Input {...props} name="nom" maxLength={120} defaultValue={values.nom} />}
        </Field>
        <Field label="Prix (F CFA)" error={errors.prix}>
          {(props) => <Input {...props} name="prix" inputMode="numeric" defaultValue={values.prix} />}
        </Field>
        <Field label="Volume (facultatif)" error={errors.volume}>
          {(props) => <Input {...props} name="volume" maxLength={40} placeholder="ex. 1,5 Go" defaultValue={values.volume} />}
        </Field>
        <Field label="Validité (facultatif)" error={errors.validite}>
          {(props) => <Input {...props} name="validite" maxLength={40} placeholder="ex. 7 jours" defaultValue={values.validite} />}
        </Field>
        <Field label="Origine du tarif" error={errors.source} hint="Catalogue du prestataire, grille officielle de l’opérateur…">
          {(props) => <Input {...props} name="source" maxLength={300} defaultValue={values.source} />}
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Ajouter au catalogue
        </SubmitButton>
      </div>
    </form>
  );
}

export function OfferToggle({ id, active }: { id: string; active: boolean }) {
  const [state, action] = useActionState(toggleCabinOfferAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="offre" value={id} />
      <input type="hidden" name="actif" value={active ? "0" : "1"} />
      <FormStatus state={state} />
      <SubmitButton variant="secondary" fullWidth={false}>
        {active ? "Retirer" : "Réactiver"}
      </SubmitButton>
    </form>
  );
}

/** États proposés au rapprochement : ceux que la base accepte depuis l'état actuel. */
const NEXT: Record<CabinStatus, CabinStatus[]> = {
  created: ["pending", "processing", "failed", "cancelled", "expired"],
  pending: ["processing", "awaiting_confirmation", "succeeded", "failed", "cancelled", "expired"],
  processing: ["awaiting_confirmation", "succeeded", "failed"],
  awaiting_confirmation: ["succeeded", "failed", "refunded"],
  succeeded: ["refunded"],
  failed: ["refunded"],
  cancelled: [],
  expired: [],
  refunded: [],
};

export function ReconcileForm({ operationId, status, live }: { operationId: string; status: CabinStatus; live: boolean }) {
  const [state, action] = useActionState(reconcileCabinOperationAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  // « Réussie » exige le mode réel et la référence du prestataire (règle en base).
  const options = NEXT[status].filter((next) => live || next !== "succeeded");
  if (options.length === 0) return <p className="text-sm text-ink-muted">État final : aucun rapprochement possible.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="operation" value={operationId} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nouvel état constaté">
          {(props) => (
            <Select {...props} name="etat" defaultValue={options[0]}>
              {options.map((next) => (
                <option key={next} value={next}>
                  {STATUS_META[next].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Référence du prestataire" hint="Obligatoire pour « Réussie ».">
          {(props) => <Input {...props} name="reference" maxLength={120} defaultValue={state.values?.reference} />}
        </Field>
        <Field label="Raison (journalisée)" error={errors.raison}>
          {(props) => <Input {...props} name="raison" maxLength={500} defaultValue={state.values?.raison} />}
        </Field>
      </div>
      <div>
        <SubmitButton variant="secondary" fullWidth={false}>
          Enregistrer le rapprochement
        </SubmitButton>
      </div>
    </form>
  );
}
