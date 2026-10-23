"use client";

import { useRef, useState, useTransition } from "react";
import { Check, FileText, RotateCcw, Sparkles, Undo2, X } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayValue, fieldLabel } from "../domain/draft-fields";
import type { StoredSuggestion } from "../server/queries";

const ORIGIN: Record<StoredSuggestion["origin"], string> = { regles: "Règles", ia: "IA" };
const INPUT: Record<StoredSuggestion["input_kind"], string> = { texte: "texte collé", photo: "photo", pdf: "PDF" };

function Confidence({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const label = value >= 0.75 ? "élevée" : value >= 0.5 ? "moyenne" : "faible";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted" title={`Confiance ${percent} %`}>
      <span aria-hidden className="h-1.5 w-12 overflow-hidden rounded-pill bg-sand-200">
        <span className="block h-full bg-brand-600" style={{ width: `${percent}%` }} />
      </span>
      Confiance {label} ({percent} %)
    </span>
  );
}

/**
 * Assistant de saisie : import d'un texte (règles, et IA si disponible) ou d'un
 * PDF (IA), puis suggestions à appliquer, ignorer ou annuler. Rien n'est
 * appliqué sans clic ; chaque décision est enregistrée.
 */
export function AssistantPanel({
  schema,
  suggestions,
  notes,
  missing,
  ai,
  onAnalyzeText,
  onAnalyzePdf,
  onApply,
  onReject,
  onUndo,
  currentValue,
}: {
  schema: string | null;
  suggestions: StoredSuggestion[];
  notes: string[];
  missing: string[];
  ai: { available: boolean; reason: string | null };
  onAnalyzeText: (text: string, useAi: boolean) => Promise<string | null>;
  onAnalyzePdf: (file: File) => Promise<string | null>;
  onApply: (suggestion: StoredSuggestion) => void;
  onReject: (suggestion: StoredSuggestion) => void;
  onUndo: (suggestion: StoredSuggestion) => void;
  currentValue: (field: string) => unknown;
}) {
  const [text, setText] = useState("");
  const [useAi, setUseAi] = useState(ai.available);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pdf = useRef<HTMLInputElement>(null);

  const open = suggestions.filter((item) => item.status === "proposee" || item.status === "acceptee");
  const history = suggestions.filter((item) => item.status === "rejetee" || item.status === "annulee");

  return (
    <section aria-labelledby="assistant" className="flex flex-col gap-4 rounded-card border border-brand-200 bg-brand-50 p-4">
      <h2 id="assistant" className="flex items-center gap-2 text-lg font-bold">
        <Sparkles aria-hidden className="h-5 w-5 text-brand-600" />
        Assistant de saisie
      </h2>
      <p className="text-sm text-ink-muted">
        Facultatif. Collez le texte d’une annonce déjà rédigée : l’assistant propose des champs, avec l’extrait d’où ils viennent. Vous décidez de chacun.
        {!ai.available && ai.reason && ` ${ai.reason} Les règles de saisie restent disponibles.`}
      </p>

      <div className="flex flex-col gap-2">
        <label htmlFor="texte-import" className="text-sm font-semibold">
          Texte à analyser
        </label>
        <textarea
          id="texte-import"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          maxLength={20000}
          className="w-full rounded-control border border-border-strong bg-surface p-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || text.trim().length < 3}
            onClick={() =>
              startTransition(async () => {
                setMessage(await onAnalyzeText(text, useAi && ai.available));
              })
            }
          >
            {pending ? "Analyse…" : "Analyser le texte"}
          </Button>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useAi && ai.available} disabled={!ai.available} onChange={(event) => setUseAi(event.target.checked)} />
            Avec l’assistant IA
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Importer un PDF</span>
        {ai.available ? (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={pdf} type="file" accept="application/pdf" aria-label="Fichier PDF à analyser" className="text-sm" />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              icon={<FileText aria-hidden className="h-4 w-4" />}
              onClick={() => {
                const file = pdf.current?.files?.[0];
                if (!file) return setMessage("Choisissez un fichier PDF.");
                startTransition(async () => {
                  setMessage(await onAnalyzePdf(file));
                  if (pdf.current) pdf.current.value = "";
                });
              }}
            >
              Analyser le PDF
            </Button>
            <span className="text-xs text-ink-muted">10 Mo au plus. Le fichier est lu puis oublié : il n’est pas conservé.</span>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">L’import de PDF passe par l’assistant IA, indisponible ici : copiez le texte du PDF dans le champ ci-dessus.</p>
        )}
      </div>

      {message && <Alert tone="info">{message}</Alert>}
      {notes.length > 0 && (
        <Alert tone="warning" title="Remarques de l’assistant">
          <ul className="list-disc pl-4">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Alert>
      )}

      {open.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Suggestions">
          {open.map((suggestion) => {
            const current = currentValue(suggestion.field);
            const same = JSON.stringify(current) === JSON.stringify(suggestion.value);
            return (
              <li key={suggestion.id} className="flex flex-col gap-1.5 rounded-control border border-border bg-surface p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{fieldLabel(suggestion.field, schema)}</span>
                  <Badge tone={suggestion.origin === "ia" ? "accent" : "neutral"}>
                    {ORIGIN[suggestion.origin]} · {INPUT[suggestion.input_kind]}
                  </Badge>
                  <Confidence value={suggestion.confidence} />
                  {suggestion.status === "acceptee" && <Badge tone="success">Appliquée</Badge>}
                </div>
                <p className="break-words">{displayValue(suggestion.field, suggestion.value, schema)}</p>
                {suggestion.excerpt && <p className="text-xs text-ink-muted">Source : « {suggestion.excerpt} »</p>}
                {suggestion.input_kind !== "texte" && <p className="text-xs text-warning">Tiré d’un document : vérifiez avant d’appliquer.</p>}
                <div className="flex flex-wrap gap-2">
                  {suggestion.status === "proposee" ? (
                    <>
                      <Button type="button" size="sm" onClick={() => onApply(suggestion)} disabled={same} icon={<Check aria-hidden className="h-4 w-4" />}>
                        {same ? "Déjà identique" : "Appliquer"}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => onReject(suggestion)} icon={<X aria-hidden className="h-4 w-4" />}>
                        Ignorer
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="sm" variant="ghost" onClick={() => onUndo(suggestion)} icon={<Undo2 aria-hidden className="h-4 w-4" />}>
                      Annuler (revenir à : {displayValue(suggestion.field, suggestion.previous_value, schema)})
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {missing.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">À compléter si possible</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
            {missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {history.length > 0 && (
        <details className="text-sm">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-semibold">
            <RotateCcw aria-hidden className="h-4 w-4" />
            Suggestions écartées ou annulées ({history.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-ink-muted">
            {history.map((suggestion) => (
              <li key={suggestion.id}>
                {fieldLabel(suggestion.field, schema)} : {displayValue(suggestion.field, suggestion.value, schema)} — {suggestion.status === "rejetee" ? "ignorée" : "annulée"} ({ORIGIN[suggestion.origin]})
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
