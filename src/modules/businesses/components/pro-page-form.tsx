"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Sparkles } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { DAY_LABELS, WEEK_DAYS, type OpeningHours } from "@/modules/shops/domain/hours";
import { formatDayHours, type FaqItem, type ProLink } from "../domain/pro";
import { generateProTextAction, saveProPageAction } from "../server/pro-actions";

export interface ProPageFormValues {
  id: string;
  name: string;
  categoryId: string | null;
  neighborhoodId: string | null;
  description: string | null;
  services: string[];
  serviceArea: string | null;
  availabilityNote: string | null;
  acceptsQuotes: boolean;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  openingHours: OpeningHours | null;
  links: ProLink[];
  faq: FaqItem[];
}

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-card border border-border p-4">
      <legend className="px-1 font-bold">{title}</legend>
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
      {children}
    </fieldset>
  );
}

/**
 * Formulaire de la page professionnelle. L'aide IA (facultative) propose une
 * présentation et une FAQ à partir des informations déjà saisies : rien n'est
 * enregistré tant que le professionnel ne l'a pas relu et enregistré.
 */
export function ProPageForm({
  values,
  categories,
  neighborhoods,
  ai,
  readOnly,
}: {
  values: ProPageFormValues;
  categories: { id: string; name: string }[];
  neighborhoods: { id: string; name: string }[];
  ai: { available: boolean; reason: string | null };
  readOnly: boolean;
}) {
  const [state, action] = useActionState(saveProPageAction, INITIAL_FORM_STATE);
  const echo = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const [description, setDescription] = useState(echo.presentation ?? values.description ?? "");
  const [faq, setFaq] = useState<FaqItem[]>(values.faq);
  const [faqRows, setFaqRows] = useState(Math.min(10, Math.max(values.faq.length + 1, 2)));
  const [proposal, setProposal] = useState<{ presentation: string; faq: FaqItem[] } | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const value = (name: string, fallback: string | null | undefined) => echo[name] ?? fallback ?? "";

  function generate() {
    setAiMessage(null);
    startTransition(async () => {
      const result = await generateProTextAction({ page: values.id });
      if (!result.ok) setAiMessage(result.message);
      else setProposal({ presentation: result.presentation, faq: result.faq });
    });
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="page" value={values.id} />
      <FormStatus state={state} />
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        <Group title="Identité">
          <Field label="Nom affiché" required error={errors.name}>
            {(props) => <Input {...props} name="nom" maxLength={120} defaultValue={value("nom", values.name)} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Catégorie" required error={errors.categoryId}>
              {(props) => (
                <Select {...props} name="categorie" defaultValue={value("categorie", values.categoryId)}>
                  <option value="">Choisir…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Quartier (facultatif)">
              {(props) => (
                <Select {...props} name="quartier" defaultValue={value("quartier", values.neighborhoodId)}>
                  <option value="">Non précisé</option>
                  {neighborhoods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </Group>

        <Group title="Présentation" hint="Ce que vous faites, pour qui, comment. Pas de promesse que vous ne pouvez pas tenir.">
          <Field label="Présentation" error={errors.description}>
            {(props) => <Textarea {...props} name="presentation" rows={6} maxLength={3000} value={description} onChange={(event) => setDescription(event.target.value)} />}
          </Field>
          <div className="flex flex-col gap-2 rounded-control border border-brand-200 bg-brand-50 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-semibold">
              <Sparkles aria-hidden className="h-4 w-4 text-brand-600" />
              Aide à la rédaction (facultative)
            </p>
            {ai.available ? (
              <>
                <p className="text-ink-muted">Propose une présentation et des questions fréquentes à partir des seules informations enregistrées. Relisez tout : rien n’est publié sans vous.</p>
                <Button type="button" variant="secondary" size="sm" className="self-start" onClick={generate} disabled={pending}>
                  {pending ? "Rédaction…" : "Proposer un texte"}
                </Button>
              </>
            ) : (
              <p className="text-ink-muted">{ai.reason} Vous pouvez rédiger vous-même : rien n’en dépend.</p>
            )}
            {aiMessage && <p className="text-danger">{aiMessage}</p>}
            {proposal && (
              <div className="flex flex-col gap-2 rounded-control bg-surface p-3">
                <p className="text-xs font-semibold uppercase text-ink-muted">Proposition — à relire</p>
                <p className="whitespace-pre-line">{proposal.presentation}</p>
                {proposal.faq.length > 0 && (
                  <ul className="list-disc pl-5">
                    {proposal.faq.map((item) => (
                      <li key={item.question}>
                        <span className="font-semibold">{item.question}</span> {item.answer}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => setDescription(proposal.presentation)}>
                    Utiliser la présentation
                  </Button>
                  {proposal.faq.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const merged = [...faq, ...proposal.faq].slice(0, 10);
                        setFaq(merged);
                        setFaqRows(Math.min(10, merged.length + 1));
                      }}
                    >
                      Ajouter les questions
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setProposal(null)}>
                    Ignorer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Group>

        <Group title="Prestations et zone">
          <Field label="Prestations" hint="Une par ligne (30 au plus)." error={errors.services}>
            {(props) => <Textarea {...props} name="prestations" rows={5} defaultValue={value("prestations", values.services.join("\n"))} />}
          </Field>
          <Field label="Zone desservie" hint="Par exemple : San Pedro et environs, déplacement à domicile." error={errors.serviceArea}>
            {(props) => <Input {...props} name="zone" maxLength={200} defaultValue={value("zone", values.serviceArea)} />}
          </Field>
          <Field label="Disponibilité (facultatif)" hint="Mise à jour sans nouvelle relecture ; affichée comme déclarée, avec sa date." error={errors.availabilityNote}>
            {(props) => <Input {...props} name="disponibilite" maxLength={200} defaultValue={value("disponibilite", values.availabilityNote)} />}
          </Field>
          <Checkbox name="devis" value="1" label="J’accepte les demandes de devis en ligne" defaultChecked={values.acceptsQuotes} />
        </Group>

        <Group title="Horaires" hint="Par jour : vide = non renseigné, « fermé », ou des plages comme 08:00-12:00, 14:00-18:00. Ils restent « à confirmer » tant que l’équipe locale ne les a pas vérifiés.">
          <div className="grid gap-2 sm:grid-cols-2">
            {WEEK_DAYS.map((day) => (
              <Field key={day} label={DAY_LABELS[day]} error={errors[`horaires_${day}`]}>
                {(props) => <Input {...props} name={`horaires_${day}`} placeholder="08:00-17:00" defaultValue={value(`horaires_${day}`, formatDayHours(values.openingHours?.[day]))} />}
              </Field>
            ))}
          </div>
        </Group>

        <Group title="Contacts et liens" hint="Affichés sur votre page publique. La messagerie de la plateforme reste toujours disponible.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Téléphone" error={errors.phone}>
              {(props) => <Input {...props} name="telephone" type="tel" maxLength={30} defaultValue={value("telephone", values.phone)} />}
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp}>
              {(props) => <Input {...props} name="whatsapp" type="tel" maxLength={30} defaultValue={value("whatsapp", values.whatsapp)} />}
            </Field>
            <Field label="E-mail" error={errors.email}>
              {(props) => <Input {...props} name="email" type="email" maxLength={200} defaultValue={value("email", values.email)} />}
            </Field>
            <Field label="Site internet (https)" error={errors.website}>
              {(props) => <Input {...props} name="site" type="url" maxLength={300} defaultValue={value("site", values.website)} />}
            </Field>
          </div>
          <p className="text-sm font-semibold">Autres liens (réseaux sociaux…)</p>
          {errors.links && <p className="text-sm text-danger">{errors.links}</p>}
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <Input name={`lien_titre_${index}`} aria-label={`Lien ${index + 1} : titre`} placeholder="Facebook" maxLength={40} defaultValue={value(`lien_titre_${index}`, values.links[index]?.label)} />
              <Input name={`lien_url_${index}`} aria-label={`Lien ${index + 1} : adresse`} placeholder="https://…" type="url" maxLength={300} defaultValue={value(`lien_url_${index}`, values.links[index]?.url)} />
            </div>
          ))}
        </Group>

        <Group title="Questions fréquentes" hint="Dix au plus. Répondez seulement à ce que vous pouvez garantir.">
          {errors.faq && <p className="text-sm text-danger">{errors.faq}</p>}
          {Array.from({ length: faqRows }, (_, index) => (
            <div key={`${index}-${faq[index]?.question ?? ""}`} className="flex flex-col gap-1.5 rounded-control border border-border p-3">
              <Input name={`faq_q_${index}`} aria-label={`Question ${index + 1}`} placeholder="Question" maxLength={200} defaultValue={faq[index]?.question} />
              <Textarea name={`faq_r_${index}`} aria-label={`Réponse ${index + 1}`} placeholder="Réponse" rows={2} maxLength={1000} defaultValue={faq[index]?.answer} />
            </div>
          ))}
          {faqRows < 10 && (
            <Button type="button" variant="ghost" size="sm" className="self-start" icon={<Plus aria-hidden className="h-4 w-4" />} onClick={() => setFaqRows(faqRows + 1)}>
              Ajouter une question
            </Button>
          )}
        </Group>
      </fieldset>
      {readOnly ? (
        <Alert tone="info">Vous consultez cette page en lecture seule (rôle « Lecteur »).</Alert>
      ) : (
        <SubmitButton fullWidth={false}>Enregistrer la page</SubmitButton>
      )}
    </form>
  );
}
