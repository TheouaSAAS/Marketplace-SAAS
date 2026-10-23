"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/feedback";
import { SubmitButton } from "@/modules/accounts/components/form-parts";
import { INITIAL_HINT_STATE, SUGGESTION_LABELS } from "../domain/moderation-ai";
import { suggestModerationAction } from "../server/moderation-ai";

/** Suggestion facultative de l'IA ; la décision reste celle de la personne qui modère. */
export function ModerationHint({ type, id }: { type: "annonce" | "signalement"; id: string }) {
  const [state, action] = useActionState(suggestModerationAction, INITIAL_HINT_STATE);
  return (
    <div className="flex flex-col gap-2">
      {state.status !== "done" && (
        <form action={action}>
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="ghost" fullWidth={false}>
            Demander une suggestion à l’IA
          </SubmitButton>
        </form>
      )}
      {state.status === "error" && <Alert tone="warning">{state.message}</Alert>}
      {state.status === "done" && state.suggestion && (
        <Alert tone="info" title={`Suggestion de l’IA : ${SUGGESTION_LABELS[state.suggestion.avis]}`}>
          {state.suggestion.signaux.length > 0 && (
            <ul className="list-disc pl-5">
              {state.suggestion.signaux.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          )}
          {state.suggestion.motif_propose && <p className="mt-1">Motif proposé : « {state.suggestion.motif_propose} »</p>}
          <p className="mt-1 text-xs">Simple suggestion : rien n’est appliqué. La décision, son motif et sa trace restent les vôtres.</p>
        </Alert>
      )}
    </div>
  );
}
