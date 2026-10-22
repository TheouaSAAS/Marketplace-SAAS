"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { clearBoundaryAction, proposeBoundaryAction, reviewBoundaryAction, saveNeighborhoodAction } from "../server/editorial-actions";

type Source = { id: string; title: string; collected_at: string };

const VERIFICATIONS = {
  pending_validation: "À vérifier (affiché « à confirmer localement »)",
  verified: "Vérifié auprès de la source indiquée",
  placeholder: "Exemple de démonstration",
  archived: "Archivé (plus d’actualité)",
} as const;

function SourceSelect({ name, sources, defaultValue, error }: { name: string; sources: Source[]; defaultValue?: string; error?: string }) {
  return (
    <Field label="Source" hint="Les sources se créent depuis la rédaction du guide." error={error}>
      {(props) => (
        <Select {...props} name={name} defaultValue={defaultValue ?? ""}>
          <option value="">Aucune</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title} ({source.collected_at})
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/** Fiche d'un quartier : nom, noms alternatifs, description neutre, vérification, responsable. */
export function NeighborhoodForm({
  hood,
  sources,
  isSteward,
}: {
  hood: { id: string; slug: string; name: string; alt_names: string[]; description: string | null; verification_status: string; source_id: string | null; is_active: boolean };
  sources: Source[];
  isSteward: boolean;
}) {
  const [state, action] = useActionState(saveNeighborhoodAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="quartier" value={hood.id} />
      <input type="hidden" name="slug" value={hood.slug} />
      <FormStatus state={state} />
      <Field label="Nom" error={errors.nom}>
        {(props) => <Input {...props} name="nom" maxLength={80} defaultValue={values?.nom ?? hood.name} />}
      </Field>
      <Field label="Autres noms" hint="Séparés par des virgules (10 au plus) : appellations courantes, anciennes graphies." error={errors.autres_noms}>
        {(props) => <Input {...props} name="autres_noms" defaultValue={values?.autres_noms ?? hood.alt_names.join(", ")} />}
      </Field>
      <Field
        label="Description neutre"
        hint="Factuelle : situation, repères. Jamais « sûr », « calme », « meilleur », « dangereux » ou « pratique »."
        error={errors.description}
      >
        {(props) => <Textarea {...props} name="description" rows={4} maxLength={2000} defaultValue={values?.description ?? hood.description ?? ""} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vérification" error={errors.verification}>
          {(props) => (
            <Select {...props} name="verification" defaultValue={values?.verification ?? hood.verification_status}>
              {Object.entries(VERIFICATIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <SourceSelect name="source" sources={sources} defaultValue={values?.source ?? hood.source_id ?? ""} error={errors.source} />
      </div>
      <Checkbox name="actif" value="1" defaultChecked={values ? values.actif === "1" : hood.is_active} label="Actif" description="Un quartier inactif disparaît des listes et des filtres." />
      <Checkbox
        name="responsable"
        value="1"
        defaultChecked={false}
        label={isSteward ? "Vous êtes responsable de cette fiche" : "Me désigner responsable de cette fiche"}
        disabled={isSteward}
      />
      <Field label="Note de modification" hint="Conservée dans l’historique : « Orthographe corrigée », « Nom alternatif ajouté »…" error={errors.note}>
        {(props) => <Input {...props} name="note" maxLength={300} defaultValue={values?.note ?? ""} />}
      </Field>
      <SubmitButton fullWidth={false}>Enregistrer la fiche</SubmitButton>
    </form>
  );
}

/** Nouveau brouillon de périmètre (GeoJSON), contrôlé par la base. */
export function BoundaryProposalForm({ hoodId, slug, sources }: { hoodId: string; slug: string; sources: Source[] }) {
  const [state, action] = useActionState(proposeBoundaryAction, INITIAL_FORM_STATE);
  return (
    <form key={state.status === "success" ? state.message : "brouillon"} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="quartier" value={hoodId} />
      <input type="hidden" name="slug" value={slug} />
      <FormStatus state={state} />
      <Field
        label="Périmètre (GeoJSON)"
        hint="Objet Polygon ou MultiPolygon en longitude, latitude (WGS 84), par exemple exporté de geojson.io ou d’un relevé terrain."
        error={state.fieldErrors?.geojson}
      >
        {(props) => <Textarea {...props} name="geojson" rows={6} className="font-mono text-xs" defaultValue={state.status === "error" ? state.values?.geojson : ""} />}
      </Field>
      <SourceSelect name="source" sources={sources} />
      <Field label="Note (facultatif)">{(props) => <Input {...props} name="note" maxLength={1000} />}</Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer le brouillon
      </SubmitButton>
    </form>
  );
}

export function BoundaryReviewForm({ boundaryId, slug }: { boundaryId: string; slug: string }) {
  const [state, action] = useActionState(reviewBoundaryAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="brouillon" value={boundaryId} />
      <input type="hidden" name="slug" value={slug} />
      <FormStatus state={state} />
      <Field label="Note de décision (obligatoire en cas de refus)">{(props) => <Input {...props} name="note" maxLength={1000} />}</Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="valider" className="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Valider et publier
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

export function BoundaryClearForm({ hoodId, slug }: { hoodId: string; slug: string }) {
  const [state, action] = useActionState(clearBoundaryAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="quartier" value={hoodId} />
      <input type="hidden" name="slug" value={slug} />
      <FormStatus state={state} />
      <Field label="Motif du retrait" error={state.fieldErrors?.note}>
        {(props) => <Input {...props} name="note" maxLength={1000} />}
      </Field>
      <SubmitButton variant="danger" fullWidth={false}>
        Retirer le périmètre publié
      </SubmitButton>
    </form>
  );
}
