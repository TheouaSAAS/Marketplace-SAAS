"use client";

import Link from "next/link";
import { useActionState } from "react";
import { href } from "@/config/routes";
import { Alert } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/modules/accounts/components/form-parts";
import { INITIAL_ASK_STATE, type AskAction } from "../domain/ask-state";
import { NO_VERIFIED_INFO, QUESTION_MAX, formatVerifiedDate, isStale, type AssistantResult, type Passage } from "../domain/rag";

const EXCERPT = 280;

function SourceLine({ passage, number }: { passage: Passage; number?: number }) {
  const verified = formatVerifiedDate(passage.verifiedAt);
  return (
    <li className="flex flex-col gap-0.5 text-sm">
      <span className="font-semibold">
        {number !== undefined && <span className="mr-1 text-ink-muted">[{number}]</span>}
        {passage.url ? (
          <Link href={passage.url} className="underline">
            {passage.title}
          </Link>
        ) : (
          passage.title
        )}
      </span>
      <span className="text-xs text-ink-muted">
        {verified ? `Vérifié le ${verified}` : "Date de vérification inconnue"}
        {isStale(passage.verifiedAt, new Date()) && " · vérification ancienne, à confirmer"}
        {passage.sourceTitle && ` · source : ${passage.sourceTitle}`}
      </span>
    </li>
  );
}

function Passages({ passages }: { passages: Passage[] }) {
  return (
    <ul className="flex flex-col gap-3" aria-label="Passages vérifiés">
      {passages.map((passage) => (
        <li key={passage.chunkId} className="flex flex-col gap-1 rounded-card border border-border p-3">
          <ul>
            <SourceLine passage={passage} />
          </ul>
          <p className="text-sm whitespace-pre-line">{passage.content.length > EXCERPT ? `${passage.content.slice(0, EXCERPT - 1)}…` : passage.content}</p>
        </li>
      ))}
    </ul>
  );
}

function Result({ result, question }: { result: AssistantResult; question: string }) {
  if (result.kind === "answer") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-card bg-sand-50 p-3 text-sm" aria-label="Réponse">
          {result.segments.map((segment, index) => (
            <span key={index}>
              {segment.text}
              {segment.sources.length > 0 && <sup className="ml-0.5 text-xs text-brand-700">[{segment.sources.join(", ")}]</sup>}
            </span>
          ))}
        </p>
        <div>
          <p className="text-sm font-semibold">Sources</p>
          <ol className="mt-1 flex flex-col gap-2">
            {result.sources.map((source, index) => (
              <SourceLine key={source.chunkId} passage={source} number={index + 1} />
            ))}
          </ol>
        </div>
        <p className="text-xs text-ink-muted">Réponse rédigée par une IA à partir de ces seules sources : vérifiez-les avant toute démarche.</p>
      </div>
    );
  }
  if (result.kind === "sources_only") {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info">{result.reason} Voici les passages vérifiés correspondant à votre question.</Alert>
        <Passages passages={result.sources} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning" title={NO_VERIFIED_INFO}>
        Rien n’est inventé : sans source vérifiée, l’assistant ne répond pas.{" "}
        <Link href={href("search", { query: { q: question.slice(0, 120) } })} className="underline">
          Chercher dans tout le site
        </Link>{" "}
        ou consulter le{" "}
        <Link href={href("guide")} className="underline">
          guide pratique
        </Link>
        .
      </Alert>
      {result.sources.length > 0 && (
        <>
          <p className="text-sm font-semibold">Passages vérifiés proches de votre question</p>
          <Passages passages={result.sources} />
        </>
      )}
    </div>
  );
}

/** Formulaire de question et réponse sourcée ; `context` oriente la recherche (jamais conservé). */
export function AssistantPanel({ ask, context, label = "Votre question" }: { ask: AskAction; context?: string; label?: string }) {
  const [state, action] = useActionState(ask, INITIAL_ASK_STATE);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-2">
        {context && <input type="hidden" name="contexte" value={context} />}
        <Field label={label} hint="Exemple : « Où faire une copie d’acte de naissance ? » Votre question n’est pas conservée." error={state.status === "error" ? state.message : undefined}>
          {(props) => <Textarea {...props} name="question" rows={2} maxLength={QUESTION_MAX} defaultValue={state.question} required />}
        </Field>
        <div>
          <SubmitButton fullWidth={false}>Demander</SubmitButton>
        </div>
      </form>
      {state.status === "done" && state.result && (
        <section aria-live="polite" aria-label="Réponse de l’assistant">
          <Result result={state.result} question={state.question} />
        </section>
      )}
    </div>
  );
}
