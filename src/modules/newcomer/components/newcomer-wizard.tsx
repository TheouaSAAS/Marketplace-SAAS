"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/spinner";
import {
  answersSchema,
  answersToSearchParams,
  BUDGETS,
  DURATIONS,
  HOUSING,
  INTERESTS,
  MAX_PRIORITIES,
  MOBILITY,
  PRIORITIES,
  PURPOSES,
  type NewcomerAnswers,
} from "../domain/answers";

/** Brouillon conservé dans le navigateur uniquement (aucune donnée envoyée tant que la personne ne l'enregistre pas). */
const STORAGE_KEY = "cdp-nouveau-arrivant-v1";
const STEPS = ["Motif", "Séjour", "Budget et déplacements", "Priorités", "Récapitulatif"] as const;

type Draft = Partial<NewcomerAnswers>;

const EMPTY: Draft = { budget: "non_precise", mobility: "non_precise", priorities: [], interests: [] };

function readStorage(): { step: number; answers: Draft } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { step?: unknown; answers?: unknown };
    if (typeof parsed.step !== "number" || typeof parsed.answers !== "object" || parsed.answers === null) return null;
    return { step: Math.min(Math.max(parsed.step, 0), STEPS.length - 1), answers: parsed.answers as Draft };
  } catch {
    return null;
  }
}

function writeStorage(step: number, answers: Draft) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
  } catch {
    // Navigation privée ou stockage plein : le parcours fonctionne sans sauvegarde locale.
  }
}

function clearStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

const subscribeNothing = () => () => {};

/**
 * Questionnaire « Nouveau à San Pedro ? ». Rendu uniquement côté navigateur
 * (le brouillon local ne peut pas être connu du serveur) : évite tout écart
 * entre rendu serveur et reprise du brouillon.
 */
export function NewcomerWizard({ initialAnswers, aiEnabled }: { initialAnswers: NewcomerAnswers | null; aiEnabled: boolean }) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  if (!hydrated) return <Skeleton className="h-96 w-full rounded-card" />;
  return <WizardSteps initialAnswers={initialAnswers} aiEnabled={aiEnabled} />;
}

function WizardSteps({ initialAnswers, aiEnabled }: { initialAnswers: NewcomerAnswers | null; aiEnabled: boolean }) {
  const router = useRouter();
  // Réponses fournies par l'adresse (« Modifier mes réponses ») prioritaires sur le brouillon.
  const [restored] = useState(() => (initialAnswers ? null : readStorage()));
  const [step, setStep] = useState(() => (initialAnswers ? STEPS.length - 1 : (restored?.step ?? 0)));
  const [answers, setAnswers] = useState<Draft>(() => initialAnswers ?? { ...EMPTY, ...restored?.answers });
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    writeStorage(step, answers);
  }, [step, answers]);

  useEffect(() => {
    // Lecteurs d'écran et clavier : le focus suit le changement d'étape (pas au premier affichage).
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Draft) => {
    setAnswers((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const stepError = (): string | null => {
    if (step === 0 && !answers.purpose) return "Choisissez ce qui vous amène à San Pedro.";
    if (step === 1 && !answers.duration) return "Indiquez la durée prévue de votre séjour.";
    if (step === 1 && !answers.housing) return "Indiquez votre situation de logement.";
    return null;
  };

  const next = () => {
    const problem = stepError();
    if (problem) {
      setError(problem);
      return;
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  const finish = () => {
    const parsed = answersSchema.safeParse(answers);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Certaines réponses sont à compléter.");
      return;
    }
    router.push(`${href("newcomerPlan")}?${answersToSearchParams(parsed.data).toString()}`);
  };

  const restart = () => {
    clearStorage();
    setAnswers(EMPTY);
    setStep(0);
    setError(null);
  };

  const togglePriority = (key: NewcomerAnswers["priorities"][number]) => {
    const current = answers.priorities ?? [];
    update({ priorities: current.includes(key) ? current.filter((item) => item !== key) : [...current, key] });
  };
  const toggleInterest = (key: NewcomerAnswers["interests"][number]) => {
    const current = answers.interests ?? [];
    update({ interests: current.includes(key) ? current.filter((item) => item !== key) : [...current, key] });
  };

  return (
    <div className="flex flex-col gap-6">
      {restored && step > 0 && (
        <Alert
          tone="info"
          action={
            <Button variant="secondary" size="sm" onClick={restart} icon={<RotateCcw aria-hidden className="h-4 w-4" />}>
              Recommencer
            </Button>
          }
        >
          Vos réponses précédentes ont été reprises. Elles sont conservées sur cet appareil uniquement.
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-ink-muted">
          Étape {step + 1} sur {STEPS.length} · {STEPS[step]}
        </p>
        <div
          className="h-2 overflow-hidden rounded-pill bg-sand-200"
          role="progressbar"
          aria-label="Progression du questionnaire"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <div className="h-full rounded-pill bg-brand-600 transition-[width]" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
        {step === 0 && (
          <>
            <StepHeading ref={headingRef}>Qu’est-ce qui vous amène à San Pedro ?</StepHeading>
            <OptionGrid legend="Motif" name="motif" options={PURPOSES} value={answers.purpose} onChange={(purpose) => update({ purpose })} />
            {answers.purpose === "autre" && (
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Précisez en quelques mots (facultatif)
                <Input
                  maxLength={120}
                  value={answers.purposeOther ?? ""}
                  onChange={(event) => update({ purposeOther: event.target.value })}
                  placeholder="Ex. mission de quelques mois"
                />
              </label>
            )}
            {!aiEnabled && (
              <p className="flex items-start gap-2 text-sm text-ink-muted">
                <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                Bientôt : décrivez votre situation en une phrase et l’assistant préremplira ce questionnaire. Vous pourrez
                toujours tout modifier.
              </p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <StepHeading ref={headingRef}>Votre séjour</StepHeading>
            <OptionGrid legend="Combien de temps restez-vous ?" name="duree" options={DURATIONS} value={answers.duration} onChange={(duration) => update({ duration })} />
            <OptionGrid legend="Côté logement ?" name="logement" options={HOUSING} value={answers.housing} onChange={(housing) => update({ housing })} />
          </>
        )}

        {step === 2 && (
          <>
            <StepHeading ref={headingRef}>Budget et déplacements</StepHeading>
            <p className="-mt-2 text-sm text-ink-muted">
              Facultatif. Le budget sert seulement à adapter les rappels : nous n’estimons aucun prix.
            </p>
            <OptionGrid legend="Budget indicatif" name="budget" options={BUDGETS} value={answers.budget} onChange={(budget) => update({ budget })} />
            <OptionGrid
              legend="Comment pensez-vous vous déplacer ?"
              name="mobilite"
              options={MOBILITY}
              value={answers.mobility}
              onChange={(mobility) => update({ mobility })}
            />
          </>
        )}

        {step === 3 && (
          <>
            <StepHeading ref={headingRef}>Vos priorités</StepHeading>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">
                Choisissez jusqu’à {MAX_PRIORITIES} priorités ({answers.priorities?.length ?? 0}/{MAX_PRIORITIES})
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(PRIORITIES) as [NewcomerAnswers["priorities"][number], string][]).map(([key, label]) => {
                  const checked = answers.priorities?.includes(key) ?? false;
                  const full = (answers.priorities?.length ?? 0) >= MAX_PRIORITIES;
                  return (
                    <ToggleOption key={key} checked={checked} disabled={!checked && full} onChange={() => togglePriority(key)}>
                      {label}
                    </ToggleOption>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Centres d’intérêt (facultatif)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(INTERESTS) as [NewcomerAnswers["interests"][number], string][]).map(([key, label]) => (
                  <ToggleOption key={key} checked={answers.interests?.includes(key) ?? false} onChange={() => toggleInterest(key)}>
                    {label}
                  </ToggleOption>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === 4 && (
          <>
            <StepHeading ref={headingRef}>Récapitulatif</StepHeading>
            <dl className="grid gap-3 text-sm sm:grid-cols-[auto_1fr]">
              <Summary label="Motif" value={answers.purpose ? (answers.purpose === "autre" && answers.purposeOther ? answers.purposeOther : PURPOSES[answers.purpose]) : "—"} onEdit={() => setStep(0)} />
              <Summary label="Durée" value={answers.duration ? DURATIONS[answers.duration] : "—"} onEdit={() => setStep(1)} />
              <Summary label="Logement" value={answers.housing ? HOUSING[answers.housing] : "—"} onEdit={() => setStep(1)} />
              <Summary label="Budget" value={BUDGETS[answers.budget ?? "non_precise"]} onEdit={() => setStep(2)} />
              <Summary label="Déplacements" value={MOBILITY[answers.mobility ?? "non_precise"]} onEdit={() => setStep(2)} />
              <Summary
                label="Priorités"
                value={answers.priorities?.length ? answers.priorities.map((key) => PRIORITIES[key]).join(", ") : "Aucune"}
                onEdit={() => setStep(3)}
              />
              <Summary
                label="Intérêts"
                value={answers.interests?.length ? answers.interests.map((key) => INTERESTS[key]).join(", ") : "Aucun"}
                onEdit={() => setStep(3)}
              />
            </dl>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
          <Button
            variant="ghost"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
            icon={<ArrowLeft aria-hidden className="h-4 w-4" />}
          >
            Précédent
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Suivant <ArrowRight aria-hidden className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="accent" onClick={finish} icon={<Check aria-hidden className="h-4 w-4" />}>
              Voir mon plan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeading({ children, ref }: { children: ReactNode; ref: React.Ref<HTMLHeadingElement> }) {
  return (
    <h2 ref={ref} tabIndex={-1} className="text-xl font-bold focus:outline-none sm:text-2xl">
      {children}
    </h2>
  );
}

/** Choix unique sous forme de cartes (boutons radio natifs). */
function OptionGrid<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Record<T, string>;
  value: T | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.entries(options) as [T, string][]).map(([key, label]) => (
          <label
            key={key}
            className={cn(
              "flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-4 py-2 text-sm font-medium transition-colors",
              value === key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-border-strong hover:bg-sand-50",
            )}
          >
            <input type="radio" name={name} value={key} checked={value === key} onChange={() => onChange(key)} className="h-5 w-5 accent-brand-600" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ToggleOption({ checked, disabled = false, onChange, children }: { checked: boolean; disabled?: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-control border px-4 py-2 text-sm font-medium transition-colors",
        checked ? "border-brand-600 bg-brand-50 text-brand-800" : "border-border-strong",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-sand-50",
      )}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} className="h-5 w-5 accent-brand-600" />
      {children}
    </label>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <>
      <dt className="font-semibold text-ink-muted">{label}</dt>
      <dd className="flex items-start justify-between gap-3">
        <span>{value}</span>
        <button type="button" onClick={onEdit} className="shrink-0 font-semibold text-brand-700 hover:underline" aria-label={`Modifier : ${label}`}>
          Modifier
        </button>
      </dd>
    </>
  );
}
