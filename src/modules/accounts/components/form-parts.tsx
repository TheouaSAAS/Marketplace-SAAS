"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/form-state";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { PASSWORD_MIN_LENGTH, passwordIssues } from "../domain/schemas";

/** Bouton d'envoi : désactivé et animé pendant le traitement (évite les doubles envois). */
export function SubmitButton({
  children,
  variant = "primary",
  fullWidth = true,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} fullWidth={fullWidth} size="lg">
      {children}
    </Button>
  );
}

/** Message global d'un formulaire (succès ou erreur), annoncé aux lecteurs d'écran. */
export function FormStatus({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "success" ? "success" : "danger"}>{state.message}</Alert>;
}

const RULES = [
  { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, issue: `au moins ${PASSWORD_MIN_LENGTH} caractères` },
  { label: "Au moins une lettre", issue: "au moins une lettre" },
  { label: "Au moins un chiffre", issue: "au moins un chiffre" },
];

/**
 * Champ mot de passe avec affichage optionnel et, pour un nouveau mot de passe,
 * la liste des règles cochées en direct (mêmes règles que le serveur).
 */
export function PasswordField({
  name = "password",
  label = "Mot de passe",
  error,
  autoComplete,
  showRules = false,
}: {
  name?: string;
  label?: string;
  error?: string;
  autoComplete: "current-password" | "new-password";
  showRules?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState("");
  const issues = passwordIssues(value);

  return (
    <Field label={label} error={error} required>
      {(props) => (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input
              {...props}
              name={name}
              type={visible ? "text" : "password"}
              autoComplete={autoComplete}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff aria-hidden className="h-5 w-5" /> : <Eye aria-hidden className="h-5 w-5" />}
            </button>
          </div>
          {showRules && (
            <ul className="grid gap-1 text-sm" aria-label="Règles du mot de passe">
              {RULES.map((rule) => {
                const met = value.length > 0 && !issues.includes(rule.issue);
                return (
                  <li key={rule.label} className={cn("flex items-center gap-1.5", met ? "text-success" : "text-ink-muted")}>
                    {met ? <Check aria-hidden className="h-4 w-4" /> : <X aria-hidden className="h-4 w-4" />}
                    {rule.label}
                    <span className="sr-only">{met ? " : respectée" : " : non respectée"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}
