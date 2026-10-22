"use client";

import { useActionState } from "react";
import { Flag } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Select, Textarea } from "@/components/ui/form-controls";
import { FormStatus, SubmitButton } from "@/modules/accounts/components/form-parts";
import { REPORT_REASONS } from "../domain/report-reasons";
import { reportContentAction } from "../server/report-action";

/** Signaler une annonce ou un commentaire à l'équipe de modération (repliable). */
export function ReportForm({ target, back, label = "Signaler cette annonce" }: { target: { annonce: string } | { commentaire: string }; back: string; label?: string }) {
  const [state, action] = useActionState(reportContentAction, INITIAL_FORM_STATE);
  const [name, value] = "annonce" in target ? ["annonce", target.annonce] : ["commentaire", target.commentaire];

  return (
    <details className="text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-semibold text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <Flag aria-hidden className="h-4 w-4" />
        {label}
      </summary>
      {state.status === "success" ? (
        <FormStatus state={state} />
      ) : (
        <form action={action} className="mt-2 flex max-w-md flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <input type="hidden" name={name} value={value} />
          <input type="hidden" name="retour" value={back} />
          <FormStatus state={state} />
          <Field label="Motif" error={state.fieldErrors?.motif}>
            {(props) => (
              <Select {...props} name="motif" defaultValue={state.values?.motif ?? ""}>
                <option value="" disabled>
                  Choisir…
                </option>
                {Object.entries(REPORT_REASONS).map(([key, text]) => (
                  <option key={key} value={key}>
                    {text}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Précisions (facultatif)" error={state.fieldErrors?.details}>
            {(props) => <Textarea {...props} name="details" rows={3} maxLength={2000} defaultValue={state.values?.details} />}
          </Field>
          <p className="text-xs text-ink-muted">L’équipe examine chaque signalement. L’annonceur ne sait pas qui l’a signalé.</p>
          <div>
            <SubmitButton fullWidth={false} variant="secondary">
              Envoyer le signalement
            </SubmitButton>
          </div>
        </form>
      )}
    </details>
  );
}
