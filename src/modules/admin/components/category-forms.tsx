"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { ATTRIBUTE_SCHEMAS, FILTERABLE_FIELDS, SCHEMA_LABELS } from "@/modules/listings/domain/attributes";
import { DEPTH_LABELS, type AdminCategory, type CategoryFamily, type CategoryNode } from "../domain/categories";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "../server/category-actions";

const KEYWORDS_HINT = "Séparés par des virgules : synonymes et mots du quotidien (« clim », « fuite »…). Servent à la recherche en langage courant.";

type Values = Record<string, string | undefined>;

/** Arbre en liste déroulante : l'indentation montre le niveau. */
function treeLabel({ category, depth }: CategoryNode): string {
  return `${"   ".repeat(depth)}${depth ? "› " : ""}${category.name}${category.is_active ? "" : " (inactive)"}`;
}

function IconField({ icons, value, error }: { icons: readonly string[]; value?: string | null; error?: string }) {
  return (
    <Field label="Icône" hint="Affichée sur les cartes sans photo." error={error}>
      {(props) => (
        <Select {...props} name="icone" defaultValue={value ?? ""}>
          <option value="">Icône par défaut</option>
          {icons.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function SchemaField({ value, error, inherit }: { value?: string | null; error?: string; inherit?: boolean }) {
  return (
    <Field label="Modèle de fiche" hint="Champs spécifiques proposés à la publication et filtres de la rubrique." error={error}>
      {(props) => (
        <Select {...props} name="schema" defaultValue={value ?? ""}>
          <option value="">{inherit ? "Celui de la catégorie parente" : "Aucun (champs communs seulement)"}</option>
          {Object.entries(SCHEMA_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

/**
 * Modification d'une catégorie : nom, description, place dans l'arbre, modèle
 * de fiche et champs actifs, activation. L'adresse (slug) ne change pas : elle peut être partagée.
 */
export function CategoryEditForm({ category, parents, icons }: { category: AdminCategory; parents: CategoryNode[]; icons: readonly string[] }) {
  const [state, action] = useActionState(updateCategoryAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values: Values | undefined = state.values;
  const definitions = category.attribute_schema ? ATTRIBUTE_SCHEMAS[category.attribute_schema] : undefined;
  const filterable = category.attribute_schema ? (FILTERABLE_FIELDS[category.attribute_schema] ?? []) : [];
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="categorie" value={category.id} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label="Nom" error={errors.nom}>
          {(props) => <Input {...props} name="nom" maxLength={80} defaultValue={values?.nom ?? category.name} />}
        </Field>
        <Field label="Ordre" error={errors.ordre}>
          {(props) => <Input {...props} name="ordre" type="number" inputMode="numeric" defaultValue={values?.ordre ?? category.sort_order} />}
        </Field>
      </div>
      <Field label="Description" hint="Affichée en tête de la rubrique publique." error={errors.description}>
        {(props) => <Textarea {...props} name="description" rows={2} maxLength={300} defaultValue={values?.description ?? category.description ?? ""} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Catégorie parente" hint="Même famille, quatre niveaux au plus. Les contenus suivent la catégorie." error={errors.parent}>
          {(props) => (
            <Select {...props} name="parent" defaultValue={values?.parent ?? category.parent_id ?? ""}>
              <option value="">Aucune (rubrique principale)</option>
              {parents.map((node) => (
                <option key={node.category.id} value={node.category.id}>
                  {treeLabel(node)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <IconField icons={icons} value={values?.icone ?? category.icon} error={errors.icone} />
      </div>
      <SchemaField value={values?.schema ?? category.attribute_schema} error={errors.schema} />
      {definitions && (
        <fieldset className="flex flex-col">
          <legend className="mb-1 text-sm font-semibold">Champs proposés à la publication</legend>
          <p className="mb-1 text-xs text-ink-muted">
            Décochez un champ qui ne convient pas à cette catégorie. « Filtre » : proposé aussi comme filtre de recherche. Après un changement de
            modèle, tous les champs du nouveau modèle sont actifs.
          </p>
          <div className="grid sm:grid-cols-2">
            {Object.entries(definitions).map(([key, definition]) => (
              <Checkbox
                key={key}
                name="champs"
                value={key}
                defaultChecked={!category.attribute_fields || category.attribute_fields.includes(key)}
                label={filterable.includes(key) ? `${definition.label} · filtre` : definition.label}
              />
            ))}
          </div>
        </fieldset>
      )}
      <Field label="Mots-clés" hint={KEYWORDS_HINT} error={errors.mots_cles}>
        {(props) => <Textarea {...props} name="mots_cles" rows={2} defaultValue={values?.mots_cles ?? category.keywords.join(", ")} />}
      </Field>
      <Checkbox
        name="active"
        value="1"
        defaultChecked={values ? values.active === "1" : category.is_active}
        label="Active"
        description="Une catégorie inactive disparaît des menus, filtres et formulaires de publication ; les contenus déjà rattachés restent en place."
      />
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer
      </SubmitButton>
    </form>
  );
}

/**
 * Ajout d'une catégorie. Avec `parent` : sous-catégorie qui hérite de la
 * famille, des types de contenus et du modèle de fiche. Sans : rubrique principale de `family`.
 */
export function CategoryCreateForm({ parent, family, depth, icons }: { parent?: AdminCategory; family: CategoryFamily; depth: number; icons: readonly string[] }) {
  const [state, action] = useActionState(createCategoryAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values: Values = state.status === "success" ? {} : (state.values ?? {});
  return (
    <form key={state.status === "success" ? state.message : "brouillon"} action={action} className="flex flex-col gap-3">
      {parent ? <input type="hidden" name="parent" value={parent.id} /> : <input type="hidden" name="famille" value={family} />}
      <FormStatus state={state} />
      <p className="text-xs text-ink-muted">Niveau : {DEPTH_LABELS[depth]}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" error={errors.nom}>
          {(props) => <Input {...props} name="nom" maxLength={80} defaultValue={values.nom} />}
        </Field>
        <Field label="Adresse (facultatif)" hint="Déduite du nom si vide." error={errors.slug}>
          {(props) => <Input {...props} name="slug" maxLength={60} defaultValue={values.slug} />}
        </Field>
      </div>
      <Field label="Description (facultatif)" error={errors.description}>
        {(props) => <Textarea {...props} name="description" rows={2} maxLength={300} defaultValue={values.description} />}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <IconField icons={icons} value={values.icone ?? parent?.icon} error={errors.icone} />
        <SchemaField value={values.schema} error={errors.schema} inherit={Boolean(parent)} />
      </div>
      <Field label="Mots-clés" hint={KEYWORDS_HINT} error={errors.mots_cles}>
        {(props) => <Textarea {...props} name="mots_cles" rows={2} defaultValue={values.mots_cles} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        {parent ? `Ajouter à « ${parent.name} »` : "Ajouter la rubrique principale"}
      </SubmitButton>
    </form>
  );
}

/** Suppression : sans sous-catégorie, et seulement si une autre catégorie reprend les contenus rattachés. */
export function CategoryDeleteForm({ category, used, targets }: { category: AdminCategory; used: number; targets: CategoryNode[] }) {
  const [state, action] = useActionState(deleteCategoryAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values: Values = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="categorie" value={category.id} />
      <FormStatus state={state} />
      <p className="text-sm text-ink-muted">
        {used > 0
          ? `${used} contenu(s) rattaché(s) seront déplacés vers la catégorie choisie, sans rien perdre de leur historique.`
          : "Aucun contenu rattaché."}{" "}
        Préférez la désactivation si la catégorie peut resservir : la suppression est définitive et journalisée.
      </p>
      {used > 0 && (
        <Field label="Catégorie qui reprend les contenus" error={errors.reprise}>
          {(props) => (
            <Select {...props} name="reprise" required defaultValue={values.reprise ?? ""}>
              <option value="">Choisir…</option>
              {targets.map((node) => (
                <option key={node.category.id} value={node.category.id}>
                  {treeLabel(node)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Raison de la suppression" error={errors.raison}>
        {(props) => <Input {...props} name="raison" maxLength={500} required minLength={5} defaultValue={values.raison} />}
      </Field>
      <SubmitButton variant="danger" fullWidth={false}>
        Supprimer « {category.name} »
      </SubmitButton>
    </form>
  );
}
