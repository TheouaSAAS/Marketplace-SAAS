"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Eye, LocateFixed } from "lucide-react";
import { href } from "@/config/routes";
import { Checkbox, Radio } from "@/components/ui/choice-controls";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { ATTRIBUTE_SCHEMAS, type AttributeDefinition } from "@/modules/listings/domain/attributes";
import { getField, setField } from "../domain/draft-fields";
import {
  DESCRIPTION_MAX,
  missingInformation,
  POSITIONLESS,
  PRICE_UNITS,
  PUBLIC_PRECISIONS,
  submissionProblems,
  TITLE_MAX,
  type ListingDraft,
  type PriceUnit,
  type PublicPrecision,
} from "../domain/fields";
import { analyzePdfAction, analyzePhotoAction, analyzeTextAction, decideSuggestionAction, saveDraftAction } from "../server/actions";
import type { DraftPhoto, StoredSuggestion } from "../server/queries";
import { AssistantPanel } from "./assistant-panel";
import { PhotoManager } from "./photo-manager";

const LocationPicker = dynamic(() => import("./location-picker").then((module) => module.LocationPicker), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-card bg-sand-100 sm:h-80" />,
});

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string };

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-6">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function AttributeInput({ name, definition, value, onChange }: { name: string; definition: AttributeDefinition; value: unknown; onChange: (value: unknown) => void }) {
  const { type } = definition;
  const label = type.kind === "integer" && type.unit ? `${definition.label} (${type.unit})` : definition.label;
  if (type.kind === "list") {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
        <legend className="text-sm font-semibold">{label}</legend>
        <div className="grid gap-1 sm:grid-cols-3">
          {Object.entries(type.options).map(([key, text]) => (
            <Checkbox
              key={key}
              name={`${name}-${key}`}
              label={text}
              checked={selected.includes(key)}
              onChange={(event) => onChange(event.target.checked ? [...selected, key] : selected.filter((item) => item !== key))}
            />
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <Field label={label}>
      {(props) =>
        type.kind === "choice" || type.kind === "boolean" ? (
          <Select
            {...props}
            value={value === undefined ? "" : String(value)}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw === "" ? undefined : type.kind === "boolean" ? raw === "true" : raw);
            }}
          >
            <option value="">Non précisé</option>
            {type.kind === "boolean" ? (
              <>
                <option value="true">Oui</option>
                <option value="false">Non</option>
              </>
            ) : (
              Object.entries(type.options).map(([key, text]) => (
                <option key={key} value={key}>
                  {text}
                </option>
              ))
            )}
          </Select>
        ) : (
          <Input
            {...props}
            type={type.kind === "integer" ? "number" : type.kind === "date" ? "date" : "text"}
            inputMode={type.kind === "integer" ? "numeric" : undefined}
            min={type.kind === "integer" ? 0 : undefined}
            maxLength={type.kind === "text" ? 200 : undefined}
            value={value === undefined ? "" : String(value)}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(raw === "" ? undefined : type.kind === "integer" ? Number(raw) : raw);
            }}
          />
        )
      }
    </Field>
  );
}

/**
 * Rédaction d'une annonce : formulaire propre à la catégorie, enregistrement
 * automatique du brouillon, carte, photos et assistant de saisie facultatif.
 */
export function ListingEditor({
  listingId,
  userId,
  initialCategoryId,
  initialDraft,
  categories,
  neighborhoods,
  photos,
  initialSuggestions,
  ai,
  map,
}: {
  listingId: string;
  userId: string;
  initialCategoryId: string;
  initialDraft: ListingDraft;
  categories: { id: string; name: string; schema: string | null }[];
  neighborhoods: { id: string; name: string }[];
  photos: DraftPhoto[];
  initialSuggestions: StoredSuggestion[];
  ai: { available: boolean; reason: string | null };
  map: { enabled: boolean; tileUrl: string; attribution: string; center: { lat: number; lng: number } };
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [draft, setDraft] = useState(initialDraft);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [notes, setNotes] = useState<string[]>([]);
  const [photoCount, setPhotoCount] = useState(photos.length);
  const [locating, setLocating] = useState<string | null>(null);
  const [navigating, startNavigation] = useTransition();
  const dirty = useRef(false);
  const latest = useRef({ categoryId, draft });

  const schema = categories.find((category) => category.id === categoryId)?.schema ?? null;
  const definitions = schema ? ATTRIBUTE_SCHEMAS[schema] : undefined;
  const positionless = POSITIONLESS.includes(schema ?? "");

  const persist = useCallback(async () => {
    if (!dirty.current) return true;
    dirty.current = false;
    setSave({ kind: "saving" });
    const result = await saveDraftAction({ id: listingId, ...latest.current });
    if (result.ok) {
      setSave({ kind: "saved", at: result.savedAt });
      return true;
    }
    dirty.current = true;
    setSave({ kind: "error", message: result.message });
    return false;
  }, [listingId]);

  // Enregistrement automatique, 1,2 s après la dernière modification.
  useEffect(() => {
    latest.current = { categoryId, draft };
    if (!dirty.current) return;
    const timer = window.setTimeout(() => void persist(), 1200);
    return () => window.clearTimeout(timer);
  }, [categoryId, draft, persist]);

  const change = (next: ListingDraft | ((current: ListingDraft) => ListingDraft)) => {
    dirty.current = true;
    setDraft(next);
  };
  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => change((current) => ({ ...current, [key]: value }));

  // --- Suggestions -----------------------------------------------------------
  const merge = (rows: StoredSuggestion[]) => setSuggestions((current) => [...rows, ...current.filter((item) => !rows.some((row) => row.id === item.id))]);
  const mark = (id: string, patch: Partial<StoredSuggestion>) => setSuggestions((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function apply(suggestion: StoredSuggestion) {
    const previous = getField(draft, suggestion.field) ?? null;
    const result = await decideSuggestionAction({ id: suggestion.id, decision: "acceptee", previous });
    if (!result.ok) return setSave({ kind: "error", message: result.message ?? "Décision non enregistrée." });
    change((current) => setField(current, suggestion.field, suggestion.value));
    mark(suggestion.id, { status: "acceptee", previous_value: previous });
  }
  async function reject(suggestion: StoredSuggestion) {
    const result = await decideSuggestionAction({ id: suggestion.id, decision: "rejetee" });
    if (result.ok) mark(suggestion.id, { status: "rejetee" });
  }
  async function undo(suggestion: StoredSuggestion) {
    const result = await decideSuggestionAction({ id: suggestion.id, decision: "annulee" });
    if (!result.ok) return;
    change((current) => setField(current, suggestion.field, suggestion.previous_value));
    mark(suggestion.id, { status: "annulee" });
  }

  async function analyzeText(text: string, useAi: boolean) {
    const result = await analyzeTextAction({ id: listingId, categoryId, text, useAi });
    if (!result.ok) return result.message;
    merge(result.suggestions);
    setNotes(result.notes);
    const count = result.suggestions.length;
    return [count ? `${count} suggestion${count > 1 ? "s" : ""} ajoutée${count > 1 ? "s" : ""}.` : "Aucune information reconnue dans ce texte.", result.aiMessage].filter(Boolean).join(" ");
  }
  async function analyzePdf(file: File) {
    const form = new FormData();
    form.set("annonce", listingId);
    form.set("categorie", categoryId);
    form.set("fichier", file);
    const result = await analyzePdfAction(form);
    if (!result.ok) return result.message;
    merge(result.suggestions);
    setNotes(result.notes);
    return result.suggestions.length ? `${result.suggestions.length} suggestion(s) tirée(s) du PDF : vérifiez-les.` : "Aucune information exploitable dans ce PDF.";
  }
  async function analyzePhoto(photoId: string) {
    setNotes([]);
    const result = await analyzePhotoAction({ id: listingId, categoryId, photoId });
    if (!result.ok) return setNotes([result.message]);
    merge(result.suggestions);
    setNotes(result.notes.length ? result.notes : [result.suggestions.length ? "Suggestions tirées de la photo ajoutées : vérifiez-les." : "Rien d’exploitable sur cette photo."]);
  }

  function locate() {
    if (!navigator.geolocation) return setLocating("Position indisponible sur cet appareil.");
    setLocating("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        change((current) => ({ ...current, lat: position.coords.latitude, lng: position.coords.longitude }));
        setLocating(null);
      },
      () => setLocating("Position refusée ou indisponible : placez le repère sur la carte."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const problems = submissionProblems(draft, schema);
  const missing = missingInformation(draft, schema, photoCount);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <Section id="essentiel" title="L’essentiel">
          <Field label="Catégorie">
            {(props) => (
              <Select
                {...props}
                value={categoryId}
                onChange={(event) => {
                  dirty.current = true;
                  setCategoryId(event.target.value);
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Titre" required hint="Court et précis : ce que c’est, où, l’essentiel.">
            {(props) => <Input {...props} value={draft.title} maxLength={TITLE_MAX} onChange={(event) => set("title", event.target.value)} />}
          </Field>
          <Field label="Description" required hint="État, dimensions, conditions, disponibilité. Pas de coordonnées ici.">
            {(props) => <Textarea {...props} value={draft.description} rows={8} maxLength={DESCRIPTION_MAX} onChange={(event) => set("description", event.target.value)} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Prix (F CFA)" hint="Facultatif.">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.price ?? ""}
                  onChange={(event) => set("price", event.target.value === "" ? null : Math.max(0, Math.round(Number(event.target.value))))}
                />
              )}
            </Field>
            <Field label="Unité">
              {(props) => (
                <Select {...props} value={draft.priceUnit ?? ""} onChange={(event) => set("priceUnit", (event.target.value || null) as PriceUnit | null)}>
                  <option value="">—</option>
                  {Object.entries(PRICE_UNITS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Checkbox name="negociable" label="Prix à débattre" checked={draft.negotiable} onChange={(event) => set("negotiable", event.target.checked)} />
        </Section>

        {definitions && (
          <Section id="caracteristiques" title="Caractéristiques">
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(definitions).map(([key, definition]) => (
                <AttributeInput
                  key={`${schema}-${key}`}
                  name={key}
                  definition={definition}
                  value={draft.attributes[key]}
                  onChange={(value) => change((current) => setField(current, `attributes.${key}`, value))}
                />
              ))}
            </div>
          </Section>
        )}

        <Section id="photos" title="Photos">
          <PhotoManager listingId={listingId} userId={userId} initial={photos} aiAvailable={ai.available} onAnalyze={(photoId) => void analyzePhoto(photoId)} onCountChange={setPhotoCount} />
        </Section>

        <Section id="emplacement" title={positionless ? "Emplacement (facultatif)" : "Emplacement"}>
          {neighborhoods.length > 0 && (
            <Field label="Quartier">
              {(props) => (
                <Select {...props} value={draft.neighborhoodId ?? ""} onChange={(event) => set("neighborhoodId", event.target.value || null)}>
                  <option value="">Non précisé</option>
                  {neighborhoods.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <p className="text-sm text-ink-muted">Cliquez sur la carte pour placer l’annonce, ou faites glisser le repère. Cette position reste privée : le public ne voit que ce que vous choisissez ci-dessous.</p>
          {map.enabled ? (
            <LocationPicker lat={draft.lat} lng={draft.lng} center={map.center} tileUrl={map.tileUrl} attribution={map.attribution} onChange={(point) => change((current) => ({ ...current, ...point }))} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Latitude">{(props) => <Input {...props} type="number" step="any" value={draft.lat ?? ""} onChange={(event) => set("lat", event.target.value === "" ? null : Number(event.target.value))} />}</Field>
              <Field label="Longitude">{(props) => <Input {...props} type="number" step="any" value={draft.lng ?? ""} onChange={(event) => set("lng", event.target.value === "" ? null : Number(event.target.value))} />}</Field>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={locate} icon={<LocateFixed aria-hidden className="h-4 w-4" />}>
              Utiliser ma position
            </Button>
            {draft.lat !== null && (
              <Button type="button" variant="ghost" size="sm" onClick={() => change((current) => ({ ...current, lat: null, lng: null }))}>
                Retirer le repère
              </Button>
            )}
            {locating && <span className="text-sm text-ink-muted">{locating}</span>}
          </div>
          <Checkbox name="exacte" label="Le repère indique l’adresse exacte" checked={draft.exact} onChange={(event) => set("exact", event.target.checked)} />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-sm font-semibold">Ce que le public voit</legend>
            {Object.entries(PUBLIC_PRECISIONS).map(([key, label]) => (
              <Radio
                key={key}
                name="precision-publique"
                value={key}
                label={label}
                checked={draft.publicPrecision === key}
                disabled={key === "exact" && !draft.exact}
                onChange={() => set("publicPrecision", key as PublicPrecision)}
              />
            ))}
          </fieldset>
        </Section>

        <Section id="contact" title="Contact">
          <p className="text-sm text-ink-muted">Les visiteurs peuvent toujours vous écrire par la messagerie. Les coordonnées ne sont affichées que si vous cochez la case.</p>
          <Field label="Nom à afficher (facultatif)">{(props) => <Input {...props} value={draft.contactName ?? ""} maxLength={80} onChange={(event) => set("contactName", event.target.value || null)} />}</Field>
          {(
            [
              ["contactPhone", "showPhone", "Téléphone", "tel"],
              ["contactWhatsapp", "showWhatsapp", "WhatsApp", "tel"],
              ["contactEmail", "showEmail", "E-mail", "email"],
            ] as const
          ).map(([field, show, label, type]) => (
            <div key={field} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label={label}>{(props) => <Input {...props} type={type} value={draft[field] ?? ""} maxLength={type === "email" ? 200 : 30} onChange={(event) => set(field, event.target.value || null)} />}</Field>
              <Checkbox name={show} label="Afficher sur l’annonce" checked={draft[show]} disabled={!draft[field]} onChange={(event) => set(show, event.target.checked)} />
            </div>
          ))}
        </Section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4" aria-live="polite">
          <p className="text-sm">
            {save.kind === "saving" && "Enregistrement…"}
            {save.kind === "saved" && `Brouillon enregistré à ${TIME.format(new Date(save.at))}.`}
            {save.kind === "idle" && "Brouillon privé, enregistré automatiquement."}
          </p>
          {save.kind === "error" && <Alert tone="danger">{save.message}</Alert>}
          {problems.length > 0 ? (
            <div className="text-sm">
              <p className="font-semibold">Avant de soumettre</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
                {problems.map((problem) => (
                  <li key={problem.field}>{problem.message}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-success">Les champs obligatoires sont remplis.</p>
          )}
          <Button
            type="button"
            icon={<Eye aria-hidden className="h-4 w-4" />}
            disabled={navigating || save.kind === "saving"}
            onClick={() =>
              startNavigation(async () => {
                if (await persist()) router.push(href("publishPreview", { params: { id: listingId } }));
              })
            }
          >
            Prévisualiser et soumettre
          </Button>
        </div>
        <AssistantPanel
          schema={schema}
          suggestions={suggestions}
          notes={notes}
          missing={missing}
          ai={ai}
          onAnalyzeText={analyzeText}
          onAnalyzePdf={analyzePdf}
          onApply={(suggestion) => void apply(suggestion)}
          onReject={(suggestion) => void reject(suggestion)}
          onUndo={(suggestion) => void undo(suggestion)}
          currentValue={(field) => getField(draft, field)}
        />
      </aside>
    </div>
  );
}
