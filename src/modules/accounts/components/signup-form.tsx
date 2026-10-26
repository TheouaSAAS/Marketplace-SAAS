"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Briefcase, MailCheck, UserRound } from "lucide-react";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { BotTrap } from "@/components/ui/bot-trap";
import { signUpAction } from "../server/actions";
import { FormStatus, PasswordField, SubmitButton } from "./form-parts";
import { ResendConfirmation } from "./resend-confirmation";

type Profile = "particulier" | "professionnel";

const PROFILES: { value: Profile; title: string; description: string; icon: typeof UserRound }[] = [
  { value: "particulier", title: "Profil utilisateur", description: "Pour les particuliers : publier, contacter, enregistrer des favoris.", icon: UserRound },
  {
    value: "professionnel",
    title: "Profil professionnel",
    description: "Pour les entreprises, commerçants, associations et prestataires. Votre page publique sera visible après complétude et modération.",
    icon: Briefcase,
  },
];

/** Choix du profil en deux cartes (boutons radio natifs : clavier et lecteurs d'écran inclus). */
function ProfileChoice({ value, initial, onChange, error }: { value: Profile; initial: Profile; onChange: (profile: Profile) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">Type de profil</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {PROFILES.map((profile) => {
          const Icon = profile.icon;
          const selected = value === profile.value;
          return (
            <label
              key={profile.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-card border-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                selected ? "border-brand-600 bg-brand-50" : "border-border bg-surface hover:border-border-strong",
              )}
            >
              <span className="flex items-center gap-2 font-bold">
                <input
                  type="radio"
                  name="accountIntent"
                  value={profile.value}
                  // Non contrôlé : après un envoi, React réinitialise le formulaire sur ce choix (celui envoyé).
                  defaultChecked={initial === profile.value}
                  onChange={() => onChange(profile.value)}
                  className="h-5 w-5 accent-brand-600"
                />
                <Icon aria-hidden className="h-5 w-5 text-brand-700" />
                {profile.title}
              </span>
              <span className="text-sm text-ink-muted">{profile.description}</span>
            </label>
          );
        })}
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}

export function SignupForm({ categories }: { categories: { id: string; name: string }[] }) {
  const [state, action] = useActionState(signUpAction, INITIAL_FORM_STATE);
  const submitted: Profile = state.values?.accountIntent === "professionnel" ? "professionnel" : "particulier";
  const [profile, setProfile] = useState<Profile>(submitted);

  if (state.status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-success-soft text-success">
          <MailCheck aria-hidden className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold">Vérifiez votre boîte e-mail</h2>
        <p className="text-sm text-ink-muted">{state.message}</p>
        <p className="text-xs text-ink-subtle">
          Le lien est valable une heure et ne sert qu’une fois. Pensez à regarder dans les courriers indésirables. Votre compte reste en attente tant
          que l’adresse n’est pas confirmée.
        </p>
        <ResendConfirmation email={state.values?.email} startCoolingDown />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <BotTrap />
      <FormStatus state={state} />
      <ProfileChoice value={profile} initial={submitted} onChange={setProfile} error={state.fieldErrors?.accountIntent} />

      <Field label="Votre nom" hint="Affiché sur vos annonces et vos messages." error={state.fieldErrors?.displayName} required>
        {(props) => <Input {...props} name="displayName" autoComplete="name" defaultValue={state.values?.displayName} />}
      </Field>
      {profile === "professionnel" && (
        <div className="flex flex-col gap-4 rounded-card bg-surface-muted p-3">
          <p className="text-sm text-ink-muted">
            Ces informations préparent votre page professionnelle. Elle reste privée jusqu’à ce que vous la complétiez et que l’équipe la valide.
          </p>
          <Field label="Nom de l’activité" error={state.fieldErrors?.businessName} required>
            {(props) => <Input {...props} name="businessName" maxLength={120} autoComplete="organization" defaultValue={state.values?.businessName} />}
          </Field>
          <Field label="Secteur d’activité" error={state.fieldErrors?.businessCategory} required>
            {(props) => (
              <Select {...props} name="businessCategory" defaultValue={state.values?.businessCategory ?? ""}>
                <option value="">Choisir…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}
      <Field label="Adresse e-mail" error={state.fieldErrors?.email} required>
        {(props) => <Input {...props} name="email" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} />}
      </Field>
      <PasswordField autoComplete="new-password" error={state.fieldErrors?.password} showRules />

      <div className="flex flex-col gap-1 border-t border-border pt-3">
        <Checkbox
          name="acceptTerms"
          defaultChecked={state.values?.acceptTerms === "on"}
          aria-invalid={Boolean(state.fieldErrors?.acceptTerms) || undefined}
          label={
            <>
              J’accepte les{" "}
              <Link href={href("terms")} target="_blank" className="font-semibold text-brand-700 underline">
                conditions d’utilisation
              </Link>{" "}
              et la{" "}
              <Link href={href("privacy")} target="_blank" className="font-semibold text-brand-700 underline">
                politique de confidentialité
              </Link>
              .
            </>
          }
        />
        {state.fieldErrors?.acceptTerms && <p className="text-sm font-medium text-danger">{state.fieldErrors.acceptTerms}</p>}
        <Checkbox
          name="marketingEmail"
          defaultChecked={state.values?.marketingEmail === "on"}
          label="Recevoir les actualités de la plateforme par e-mail (facultatif)"
        />
      </div>

      <SubmitButton variant="accent">Créer mon compte</SubmitButton>
    </form>
  );
}
