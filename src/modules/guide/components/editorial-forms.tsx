"use client";

import { useActionState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { ARTICLE_STATUSES, ARTICLE_VERIFICATIONS, MARKDOWN_HELP, SOURCE_KINDS, SUGGESTION_DECISIONS } from "../domain/editorial";
import { decideSuggestionAction, saveArticleAction } from "../server/editorial-actions";

export interface ArticleDraft {
  id?: string;
  section_id?: string;
  slug?: string;
  title?: string;
  summary?: string | null;
  body?: string;
  status?: string;
  verification_status?: string;
  source_id?: string | null;
}

/** Rédaction d'un article : chaque enregistrement exige une note, conservée avec la version. */
export function ArticleEditorForm({
  draft,
  sections,
  sources,
}: {
  draft: ArticleDraft;
  sections: { id: string; name: string }[];
  sources: { id: string; title: string; collected_at: string }[];
}) {
  const [state, action] = useActionState(saveArticleAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const value = (name: string, fallback: string | null | undefined) => values[name] ?? fallback ?? "";
  return (
    <form action={action} className="flex flex-col gap-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      {draft.id && <input type="hidden" name="slug" value={draft.slug} />}
      <FormStatus state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Rubrique" error={errors.rubrique}>
          {(props) => (
            <Select {...props} name="rubrique" defaultValue={value("rubrique", draft.section_id)}>
              <option value="">Choisir…</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {draft.id ? (
          <Field label="Adresse" hint="Fixe une fois l’article créé (elle peut être partagée).">
            {(props) => <Input {...props} value={draft.slug} readOnly />}
          </Field>
        ) : (
          <Field label="Adresse (facultatif)" hint="Déduite du titre si vide." error={errors.slug}>
            {(props) => <Input {...props} name="slug" maxLength={80} defaultValue={value("slug", "")} />}
          </Field>
        )}
      </div>
      <Field label="Titre" error={errors.titre}>
        {(props) => <Input {...props} name="titre" maxLength={160} defaultValue={value("titre", draft.title)} />}
      </Field>
      <Field label="Résumé (facultatif)" error={errors.resume}>
        {(props) => <Textarea {...props} name="resume" rows={2} maxLength={300} defaultValue={value("resume", draft.summary)} />}
      </Field>
      <Field label="Texte" hint={MARKDOWN_HELP} error={errors.corps}>
        {(props) => <Textarea {...props} name="corps" rows={18} maxLength={50000} defaultValue={value("corps", draft.body)} className="font-mono text-sm" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Publication" error={errors.statut}>
          {(props) => (
            <Select {...props} name="statut" defaultValue={value("statut", draft.status ?? "draft")}>
              {Object.entries(ARTICLE_STATUSES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Vérification" error={errors.verification}>
          {(props) => (
            <Select {...props} name="verification" defaultValue={value("verification", draft.verification_status ?? "pending_validation")}>
              {Object.entries(ARTICLE_VERIFICATIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Source</legend>
        <Field label="Source existante" error={errors.source}>
          {(props) => (
            <Select {...props} name="source" defaultValue={value("source", draft.source_id)}>
              <option value="">Aucune / nouvelle source ci-dessous</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title} ({source.collected_at})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Créer une nouvelle source</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Intitulé" error={errors.source_titre}>
              {(props) => <Input {...props} name="source_titre" maxLength={200} defaultValue={value("source_titre", "")} />}
            </Field>
            <Field label="Type">
              {(props) => (
                <Select {...props} name="source_type" defaultValue={value("source_type", "terrain")}>
                  {Object.entries(SOURCE_KINDS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Éditeur (facultatif)">
              {(props) => <Input {...props} name="source_editeur" maxLength={200} defaultValue={value("source_editeur", "")} />}
            </Field>
            <Field label="Adresse web (facultatif)" error={errors.source_url}>
              {(props) => <Input {...props} name="source_url" type="url" defaultValue={value("source_url", "")} />}
            </Field>
            <Field label="Consultée le" error={errors.source_date}>
              {(props) => <Input {...props} name="source_date" type="date" defaultValue={value("source_date", "")} />}
            </Field>
          </div>
        </details>
      </fieldset>
      <Field label="Note de modification" hint="Conservée avec la version : « Création », « Mise à jour des tarifs »…" error={errors.note}>
        {(props) => <Input {...props} name="note" maxLength={300} defaultValue={value("note", draft.id ? "" : "Création de l’article")} />}
      </Field>
      <SubmitButton fullWidth={false}>Enregistrer</SubmitButton>
    </form>
  );
}

/** Décision sur une suggestion de correction. */
export function SuggestionDecisionForm({ suggestionId, articleId, status }: { suggestionId: string; articleId: string; status: string }) {
  const [state, action] = useActionState(decideSuggestionAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="suggestion" value={suggestionId} />
      <input type="hidden" name="article" value={articleId} />
      <FormStatus state={state} />
      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Décision">
          {(props) => (
            <Select {...props} name="decision" defaultValue={status === "open" ? "reviewing" : status}>
              {Object.entries(SUGGESTION_DECISIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Réponse interne (facultatif)" error={state.fieldErrors?.reponse}>
          {(props) => <Input {...props} name="reponse" maxLength={1000} />}
        </Field>
      </div>
      <SubmitButton variant="secondary" fullWidth={false}>
        Enregistrer la décision
      </SubmitButton>
    </form>
  );
}
