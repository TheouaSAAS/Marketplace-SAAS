"use client";

import Link from "next/link";
import { useActionState } from "react";
import { href } from "@/config/routes";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Field, Input } from "@/components/ui/form-controls";
import { adminSignInAction, enrollSecondFactorAction, verifySecondFactorAction, type EnrollState } from "../server/admin-auth-actions";
import { FormStatus, PasswordField, SubmitButton } from "./form-parts";

export function AdminLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(adminSignInAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="suivant" value={next} />
      <Field label="Adresse e-mail professionnelle" error={state.fieldErrors?.email} required>
        {(props) => <Input {...props} name="email" type="email" autoComplete="username" inputMode="email" defaultValue={state.values?.email} />}
      </Field>
      <PasswordField autoComplete="current-password" error={state.fieldErrors?.password} />
      <Link href={href("forgotPassword")} className="-mt-1 self-end text-sm font-semibold text-brand-700 hover:underline">
        Mot de passe oublié ?
      </Link>
      <SubmitButton>Se connecter à l’administration</SubmitButton>
    </form>
  );
}

function CodeForm({ factorId, next, label }: { factorId: string; next: string; label: string }) {
  const [state, action] = useActionState(verifySecondFactorAction, INITIAL_FORM_STATE);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormStatus state={state} />
      <input type="hidden" name="factorId" value={factorId} />
      <input type="hidden" name="suivant" value={next} />
      <Field label="Code à 6 chiffres" hint="Affiché par votre application d’authentification ; il change toutes les 30 secondes." error={state.fieldErrors?.code} required>
        {(props) => (
          <Input {...props} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="text-center text-lg tracking-[0.4em]" />
        )}
      </Field>
      <SubmitButton>{label}</SubmitButton>
    </form>
  );
}

/** Second facteur déjà configuré : saisie du code. */
export function SecondFactorChallenge({ factorId, next }: { factorId: string; next: string }) {
  return <CodeForm factorId={factorId} next={next} label="Vérifier et ouvrir l’administration" />;
}

/** Première configuration : QR code (ou clé), puis premier code pour l'activer. */
export function SecondFactorSetup({ next }: { next: string }) {
  const [state, action] = useActionState<EnrollState>(enrollSecondFactorAction, INITIAL_FORM_STATE);
  if (!state.factorId) {
    return (
      <form action={action} className="flex flex-col gap-4">
        <FormStatus state={state} />
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>Installez une application d’authentification sur votre téléphone (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS…).</li>
          <li>Préparez le QR code ci-dessous, puis scannez-le avec l’application.</li>
          <li>Saisissez le code qu’elle affiche pour activer le second facteur.</li>
        </ol>
        <SubmitButton>Préparer mon second facteur</SubmitButton>
      </form>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        {/* QR code fourni par le fournisseur d'authentification (image SVG en data:), jamais conservé par la plateforme. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.qrCode} alt="QR code à scanner avec votre application d’authentification" width={192} height={192} className="rounded-control border border-border bg-white p-2" />
        <details className="w-full text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold">Impossible de scanner ? Saisir la clé</summary>
          <p className="mt-1 break-all rounded-control bg-sand-100 p-2 font-mono text-sm">{state.secret}</p>
        </details>
      </div>
      <CodeForm factorId={state.factorId} next={next} label="Activer le second facteur" />
    </div>
  );
}
