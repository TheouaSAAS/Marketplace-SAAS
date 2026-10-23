"use client";

import { useActionState, useRef, useState } from "react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox, Radio } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { APPLY_MODES, CONTRACTS, DOMAINS, EXPERIENCE, ORGANIZATIONS, REMOTE } from "../domain/attributes";
import { parseOfferText, type OfferDraft } from "../domain/import";
import { PUBLICATION_RULES } from "../domain/rules";
import {
  applyAction,
  closeJobAction,
  deleteCandidateProfileAction,
  moderateJobAction,
  publishJobAction,
  revealCandidateContactAction,
  saveCandidateProfileAction,
  setApplicationStatusAction,
} from "../server/actions";

function Options({ table, empty }: { table: Record<string, string>; empty?: string }) {
  return (
    <>
      {empty !== undefined && <option value="">{empty}</option>}
      {Object.entries(table).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

/** Candidature interne : un message de présentation, visible du seul employeur. */
export function ApplyForm({ offerId, back }: { offerId: string; back: string }) {
  const [state, action] = useActionState(applyAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <FormStatus state={state} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="offre" value={offerId} />
      <input type="hidden" name="retour" value={back} />
      <FormStatus state={state} />
      <Field label="Votre présentation" hint="Expérience, disponibilité, motivation. Ne mettez pas de pièce d’identité." error={state.fieldErrors?.message}>
        {(props) => <Textarea {...props} name="message" rows={5} maxLength={5000} defaultValue={state.values?.message} />}
      </Field>
      <SubmitButton>Envoyer ma candidature</SubmitButton>
      <p className="text-xs text-ink-muted">Connexion requise. Seul l’employeur voit votre candidature ; vous pouvez la retirer à tout moment.</p>
    </form>
  );
}

/** Statut d'une candidature : l'employeur décide, le candidat peut retirer. */
export function ApplicationStatusForm({ applicationId, mode }: { applicationId: string; mode: "employer" | "applicant" }) {
  const [state, action] = useActionState(setApplicationStatusAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="candidature" value={applicationId} />
      {mode === "employer" ? (
        <>
          <Field label="Décision">
            {(props) => (
              <Select {...props} name="statut" defaultValue="viewed" className="w-52">
                <option value="viewed">Vue</option>
                <option value="shortlisted">Retenue pour la suite</option>
                <option value="rejected">Non retenue</option>
              </Select>
            )}
          </Field>
          <SubmitButton variant="secondary" fullWidth={false}>
            Enregistrer
          </SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="statut" value="withdrawn" />
          <SubmitButton variant="ghost" fullWidth={false}>
            Retirer ma candidature
          </SubmitButton>
        </>
      )}
      <FormStatus state={state} />
    </form>
  );
}

export function CloseJobButton({ offerId }: { offerId: string }) {
  const [state, action] = useActionState(closeJobAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="offre" value={offerId} />
      <FormStatus state={state} />
      {state.status !== "success" && (
        <SubmitButton variant="secondary" fullWidth={false}>
          Clôturer l’offre
        </SubmitButton>
      )}
    </form>
  );
}

export interface CandidateDraft {
  headline?: string;
  summary?: string | null;
  skills?: string[];
  domains?: string[];
  experience?: string | null;
  available?: boolean;
  visibility?: string;
  share_contact?: boolean;
  contact_email?: string | null;
  contact_phone?: string | null;
}

/** Profil candidat : privé par défaut ; visibilité et partage des coordonnées au choix du candidat. */
export function CandidateProfileForm({ draft }: { draft: CandidateDraft }) {
  const [state, action] = useActionState(saveCandidateProfileAction, INITIAL_FORM_STATE);
  const [removed, remove] = useActionState(deleteCandidateProfileAction, INITIAL_FORM_STATE);
  const errors = state.fieldErrors ?? {};
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <FormStatus state={state} />
        <Field label="Titre du profil" hint="Par exemple : « Comptable, 3 ans d’expérience »." error={errors.titre}>
          {(props) => <Input {...props} name="titre" maxLength={120} defaultValue={state.values?.titre ?? draft.headline} />}
        </Field>
        <Field label="Présentation (facultatif)" error={errors.resume}>
          {(props) => <Textarea {...props} name="resume" rows={4} maxLength={2000} defaultValue={state.values?.resume ?? draft.summary ?? ""} />}
        </Field>
        <Field label="Compétences" hint="Séparées par des virgules (20 au plus)." error={errors.competences}>
          {(props) => <Input {...props} name="competences" defaultValue={state.values?.competences ?? draft.skills?.join(", ")} />}
        </Field>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Domaines (5 au plus)</legend>
          <div className="grid gap-x-3 sm:grid-cols-2">
            {Object.entries(DOMAINS).map(([value, label]) => (
              <Checkbox key={value} name="domaines" value={value} label={label} defaultChecked={draft.domains?.includes(value)} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expérience">
            {(props) => (
              <Select {...props} name="experience" defaultValue={draft.experience ?? ""}>
                <Options table={EXPERIENCE} empty="Non précisée" />
              </Select>
            )}
          </Field>
          <Checkbox name="disponible" value="1" label="Disponible dès maintenant" defaultChecked={draft.available ?? true} />
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">Qui peut voir ce profil ?</legend>
          <Radio name="visibilite" value="private" label="Personne (privé)" defaultChecked={(draft.visibility ?? "private") === "private"} />
          <Radio name="visibilite" value="employers" label="Les comptes employeurs connectés" defaultChecked={draft.visibility === "employers"} />
          <Radio name="visibilite" value="public" label="Tout le monde" defaultChecked={draft.visibility === "public"} />
        </fieldset>
        <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Coordonnées (jamais affichées sans votre accord)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="E-mail" error={errors.email}>
              {(props) => <Input {...props} name="email" type="email" defaultValue={state.values?.email ?? draft.contact_email ?? ""} />}
            </Field>
            <Field label="Téléphone" error={errors.telephone}>
              {(props) => <Input {...props} name="telephone" type="tel" maxLength={30} defaultValue={state.values?.telephone ?? draft.contact_phone ?? ""} />}
            </Field>
          </div>
          <Checkbox
            name="partage"
            value="1"
            defaultChecked={draft.share_contact ?? false}
            label="Les employeurs qui voient mon profil peuvent afficher ces coordonnées"
            description="Sinon, ils ne peuvent pas vous joindre en dehors de vos candidatures."
          />
        </fieldset>
        <SubmitButton fullWidth={false}>Enregistrer mon profil</SubmitButton>
      </form>
      {draft.headline && (
        <form action={remove}>
          <FormStatus state={removed} />
          <SubmitButton variant="ghost" fullWidth={false}>
            Supprimer mon profil candidat
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

export function RevealContactButton({ candidateId }: { candidateId: string }) {
  const [state, action] = useActionState(revealCandidateContactAction, INITIAL_FORM_STATE);
  if (state.status === "success") return <p className="text-sm font-medium">{state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="candidat" value={candidateId} />
      <SubmitButton variant="secondary" fullWidth={false}>
        Afficher les coordonnées
      </SubmitButton>
      {state.status === "error" && <p className="text-sm text-ink-muted">{state.message}</p>}
    </form>
  );
}

/** Publication d'une offre : rappel des règles, pré-remplissage depuis un texte collé, envoi en modération. */
export function PublishJobForm({ categories, neighborhoods }: { categories: { id: string; name: string }[]; neighborhoods: { id: string; name: string }[] }) {
  const [state, action] = useActionState(publishJobAction, INITIAL_FORM_STATE);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const pasted = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState(state.values?.candidature ?? "interne");
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const value = (name: keyof OfferDraft | string, fallback?: string | null) => values[name] ?? fallback ?? "";

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="regles" className="rounded-card border border-border bg-surface p-4">
        <h2 id="regles" className="mb-2 font-bold">
          Règles de publication
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
          {PUBLICATION_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <details className="rounded-card border border-border bg-surface p-4">
        <summary className="cursor-pointer font-semibold">Pré-remplir depuis le texte d’une offre (LinkedIn, site, affiche)</summary>
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm text-ink-muted">
            Collez le texte : titre, contrat, date limite, e-mail et lien sont reconnus par des règles fixes. Rien n’est récupéré sur le site d’origine ;
            relisez chaque champ avant d’envoyer. L’aide par intelligence artificielle viendra plus tard.
          </p>
          <label htmlFor="texte-offre" className="text-sm font-semibold">
            Texte de l’offre
          </label>
          <textarea id="texte-offre" ref={pasted} rows={6} className="w-full rounded-control border border-border-strong bg-surface p-3 text-sm" />
          <Button type="button" variant="secondary" onClick={() => setDraft(parseOfferText(pasted.current?.value ?? "", new Date()))}>
            Pré-remplir le formulaire
          </Button>
          {draft && (
            <p role="status" className="text-sm">
              {draft.found.length > 0 ? `Reconnu : ${draft.found.join(", ")}. Vérifiez et complétez.` : "Rien de reconnu : remplissez le formulaire."}
            </p>
          )}
        </div>
      </details>
      <form key={draft ? JSON.stringify(draft) : "vide"} action={action} className="flex flex-col gap-4">
        <FormStatus state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type d’annonce" error={errors.categorie}>
            {(props) => (
              <Select {...props} name="categorie" defaultValue={value("categorie")}>
                <option value="">Choisir…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Type d’organisation" error={errors.organisation}>
            {(props) => (
              <Select {...props} name="organisation" defaultValue={value("organisation")}>
                <Options table={ORGANIZATIONS} empty="Choisir…" />
              </Select>
            )}
          </Field>
        </div>
        <Field label="Intitulé" error={errors.titre}>
          {(props) => <Input {...props} name="titre" maxLength={120} defaultValue={value("titre", draft?.titre)} />}
        </Field>
        <Field label="Description" hint="Missions, profil recherché, rémunération si possible, modalités." error={errors.description}>
          {(props) => <Textarea {...props} name="description" rows={8} maxLength={10000} defaultValue={value("description", draft?.description)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contrat">
            {(props) => (
              <Select {...props} name="contrat" defaultValue={value("contrat", draft?.contrat)}>
                <Options table={CONTRACTS} empty="Non précisé" />
              </Select>
            )}
          </Field>
          <Field label="Domaine">
            {(props) => (
              <Select {...props} name="domaine" defaultValue={value("domaine")}>
                <Options table={DOMAINS} empty="Non précisé" />
              </Select>
            )}
          </Field>
          <Field label="Expérience demandée">
            {(props) => (
              <Select {...props} name="experience" defaultValue={value("experience")}>
                <Options table={EXPERIENCE} empty="Non précisée" />
              </Select>
            )}
          </Field>
          <Field label="Lieu de travail">
            {(props) => (
              <Select {...props} name="teletravail" defaultValue={value("teletravail")}>
                <Options table={REMOTE} empty="Non précisé" />
              </Select>
            )}
          </Field>
          <Field label="Quartier (facultatif)">
            {(props) => (
              <Select {...props} name="quartier" defaultValue={value("quartier")}>
                <option value="">Non précisé</option>
                {neighborhoods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Date limite de candidature (facultatif)" hint="L’offre se clôt automatiquement le lendemain." error={errors.date_limite}>
            {(props) => <Input {...props} name="date_limite" type="date" defaultValue={value("date_limite", draft?.date_limite)} />}
          </Field>
        </div>
        <fieldset className="flex flex-col gap-2 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold">Candidature</legend>
          {Object.entries(APPLY_MODES).map(([key, label]) => (
            <Radio key={key} name="candidature" value={key} label={label} checked={mode === key} onChange={() => setMode(key)} />
          ))}
          {mode === "externe" && (
            <Field label="Lien de candidature (https)" hint="Affiché avec le nom du site : le candidat sait qu’il quitte la plateforme." error={errors.lien}>
              {(props) => <Input {...props} name="lien" type="url" defaultValue={value("lien", draft?.lien)} />}
            </Field>
          )}
        </fieldset>
        <Field label="Nom à afficher pour l’employeur (facultatif)" hint="Entreprise, association… Sinon, le type d’organisation est affiché.">
          {(props) => <Input {...props} name="contact" maxLength={80} defaultValue={value("contact")} />}
        </Field>
        <SubmitButton fullWidth={false}>Envoyer l’offre en modération</SubmitButton>
      </form>
    </div>
  );
}

export function JobModerationForm({ offerId }: { offerId: string }) {
  const [state, action] = useActionState(moderateJobAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="offre" value={offerId} />
      <FormStatus state={state} />
      <Field label="Motif (obligatoire en cas de refus, transmis à l’auteur)" error={state.fieldErrors?.motif}>
        {(props) => <Input {...props} name="motif" maxLength={500} />}
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="publier" className="inline-flex h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Publier
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
