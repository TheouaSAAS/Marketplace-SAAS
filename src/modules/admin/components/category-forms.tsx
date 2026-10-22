"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import type { AdminCategory } from "../domain/categories";
import { createCategoryAction, updateCategoryAction } from "../server/category-actions";

const KEYWORDS_HINT = "Séparés par des virgules : synonymes et mots du quotidien (« clim », « fuite »…). Servent à la recherche en langage courant.";

/** Modification d'une catégorie : nom, mots-clés, ordre, activation. L'adresse (slug) ne change pas : elle peut être partagée. */
export function CategoryEditForm({ category }: { category: AdminCategory }) {
  const [state, action] = useActionState(updateCategoryAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
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
      <Field label="Mots-clés" hint={KEYWORDS_HINT} error={errors.mots_cles}>
        {(props) => <Textarea {...props} name="mots_cles" rows={2} defaultValue={values?.mots_cles ?? category.keywords.join(", ")} />}
      </Field>
      <Checkbox
        name="active"
        value="1"
        defaultChecked={values ? values.active === "1" : category.is_active}
        label="Active"
        description="Une catégorie inactive disparaît des menus, filtres et formulaires ; les contenus déjà rattachés restent en place."
      />
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer
      </SubmitButton>
    </form>
  );
}

/** Ajout d'une sous-catégorie : elle hérite de la famille, des types de contenus et des attributs du parent. */
export function CategoryCreateForm({ parent }: { parent: AdminCategory }) {
  const [state, action] = useActionState(createCategoryAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.status === "success" ? {} : (state.values ?? {});
  return (
    <form key={state.status === "success" ? state.message : "brouillon"} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="parent" value={parent.id} />
      <FormStatus state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom" error={errors.nom}>
          {(props) => <Input {...props} name="nom" maxLength={80} defaultValue={values.nom} />}
        </Field>
        <Field label="Adresse (facultatif)" hint="Déduite du nom si vide." error={errors.slug}>
          {(props) => <Input {...props} name="slug" maxLength={60} defaultValue={values.slug} />}
        </Field>
      </div>
      <Field label="Mots-clés" hint={KEYWORDS_HINT} error={errors.mots_cles}>
        {(props) => <Textarea {...props} name="mots_cles" rows={2} defaultValue={values.mots_cles} />}
      </Field>
      <SubmitButton variant="secondary" fullWidth={false}>
        Ajouter à « {parent.name} »
      </SubmitButton>
    </form>
  );
}
