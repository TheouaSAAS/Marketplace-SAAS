import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { href } from "@/config/routes";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Radio } from "@/components/ui/choice-controls";
import { Container } from "@/components/ui/container";
import { Field, Select } from "@/components/ui/form-controls";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { BUDGET_LEVELS } from "@/modules/shops/domain/attributes";
import { ACCESSIBILITY, AUDIENCES, THEMES, TO_CONFIRM, VISIT_DURATIONS, type VisitDuration } from "@/modules/tourism/domain/attributes";
import { ITINERARY_LENGTHS, type ItineraryRequest, type ItineraryStep } from "@/modules/tourism/domain/itinerary";
import { TourismAdvice } from "@/modules/tourism/components/tourism-explorer";
import { loadItinerary } from "@/modules/tourism/server/page-data";

export const metadata: Metadata = {
  title: "Créer un itinéraire à San Pedro",
  description: "Un itinéraire composé uniquement de lieux réellement enregistrés, avec leur statut de vérification, sans horaires ni trajets inventés.",
};

type Raw = Record<string, string | string[] | undefined>;

function RequestForm({ request }: { request: ItineraryRequest | null }) {
  return (
    <Form action={href("itinerary")} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4" aria-label="Votre itinéraire">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Durée</legend>
        {Object.entries(ITINERARY_LENGTHS).map(([value, label]) => (
          <Radio key={value} name="duree" value={value} label={label} defaultChecked={(request?.duree ?? "journee") === value} />
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Envies (facultatif)</legend>
        <div className="grid grid-cols-2 gap-x-3">
          {Object.entries(THEMES).map(([value, label]) => (
            <Checkbox key={value} name="themes" value={value} label={label} defaultChecked={request?.themes.includes(value as never)} />
          ))}
        </div>
      </fieldset>
      <Field label="Avec qui ?">
        {(props) => (
          <Select {...props} name="public" defaultValue={request?.public ?? ""}>
            <option value="">Peu importe</option>
            {Object.entries(AUDIENCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Budget indicatif" hint="Un lieu dont le budget n’est pas renseigné est alors écarté.">
        {(props) => (
          <Select {...props} name="budget" defaultValue={request?.budget ? String(request.budget) : ""}>
            <option value="">Peu importe</option>
            {Object.entries(BUDGET_LEVELS).map(([value, label]) => (
              <option key={value} value={value}>
                {value === "4" ? label : `Jusqu’à « ${label.toLowerCase()} »`}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-semibold">Accessibilité requise</legend>
        {Object.entries(ACCESSIBILITY).map(([value, label]) => (
          <Checkbox key={value} name="acces" value={value} label={label} defaultChecked={request?.acces.includes(value as never)} />
        ))}
      </fieldset>
      <Checkbox name="verifie" value="1" label="Seulement des lieux vérifiés" defaultChecked={request?.verifie} />
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        Composer l’itinéraire
      </button>
    </Form>
  );
}

function Step({ step, index }: { step: ItineraryStep; index: number }) {
  const heading = `${step.moment} · ${step.slot}`;
  if (step.kind === "missing") {
    return (
      <li className="flex flex-col gap-1 rounded-card border border-dashed border-border-strong p-4">
        <p className="text-sm font-semibold text-ink-muted">{heading}</p>
        <p className="text-sm">Aucun lieu enregistré ne correspond à vos critères pour ce moment : à compléter localement. Rien n’est inventé pour combler.</p>
      </li>
    );
  }
  const { place } = step;
  const duration = place.visit_duration && Object.hasOwn(VISIT_DURATIONS, place.visit_duration) ? VISIT_DURATIONS[place.visit_duration as VisitDuration] : null;
  return (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-ink-muted">{heading}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-brand-600 text-sm font-bold text-white">{index + 1}</span>
        <Link className="text-lg font-bold underline" href={href("placeDetail", { params: { slug: place.slug } })}>
          {place.name}
        </Link>
        {place.verification_status === "placeholder" ? (
          <Badge tone="warning">Exemple</Badge>
        ) : (
          <Badge tone={step.verified ? "success" : "warning"}>{step.verified ? "Vérifié" : "À confirmer"}</Badge>
        )}
      </div>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-sm text-ink-muted">
        {step.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      <p className="text-sm">Durée de visite : {duration ?? TO_CONFIRM.toLowerCase()}</p>
      {step.distanceKm !== null && (
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          <MapPin aria-hidden className="h-4 w-4" />
          Environ {step.distanceKm < 1 ? `${Math.max(100, Math.round(step.distanceKm * 10) * 100)} m` : `${step.distanceKm.toFixed(1).replace(".", ",")} km`} à vol
          d’oiseau de l’étape précédente — trajet et moyen de transport à prévoir sur place.
        </p>
      )}
      {place.warnings && (
        <p className="flex items-start gap-1.5 text-sm font-medium text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {place.warnings}
        </p>
      )}
    </li>
  );
}

async function Result({ searchParams }: { searchParams: Promise<Raw> }) {
  const data = await loadItinerary(await searchParams);
  if (data.kind === "redirect") redirect(`${href("itinerary")}?${data.query}`);
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Itinéraires indisponibles">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="Itinéraire momentanément indisponible" description="Réessayez dans quelques instants." />;
  if (data.kind === "form") {
    return (
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
        <RequestForm request={null} />
        <TourismAdvice />
      </div>
    );
  }
  const found = data.steps.filter((step) => step.kind === "place").length;
  const days = [...new Set(data.steps.map((step) => step.day))];
  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
      <RequestForm request={data.request} />
      <section aria-labelledby="itineraire" className="flex min-w-0 flex-col gap-4">
        <h2 id="itineraire" className="text-xl font-bold">
          Votre itinéraire · {ITINERARY_LENGTHS[data.request.duree].toLowerCase()}
        </h2>
        <Alert tone="info" title="Comment il est composé">
          Avec les seuls lieux enregistrés ({data.available} disponibles), sans intelligence artificielle : les lieux vérifiés d’abord, puis ceux qui
          correspondent à vos envies, puis le plus proche de l’étape précédente. Matin, midi, soir sont des repères, pas des horaires.
        </Alert>
        {found === 0 && (
          <Alert tone="warning" title="Pas encore assez de lieux">
            Aucun lieu enregistré ne correspond à ces critères. Retirez une exigence, ou revenez quand l’équipe locale aura ajouté des fiches.
          </Alert>
        )}
        {days.map((day) => (
          <div key={day} className="flex flex-col gap-3">
            {days.length > 1 && <h3 className="text-lg font-bold">Jour {day}</h3>}
            <ol className="flex flex-col gap-3">
              {data.steps
                .filter((step) => step.day === day)
                .map((step) => (
                  <Step key={`${step.day}-${step.moment}`} step={step} index={data.steps.indexOf(step)} />
                ))}
            </ol>
          </div>
        ))}
        <TourismAdvice />
      </section>
    </div>
  );
}

export default function ItineraryPage({ searchParams }: PageProps<"/tourisme/itineraire">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Découvrir et sortir", href: href("discover") }, { label: "Créer un itinéraire" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Créer un itinéraire</h1>
        <p className="max-w-2xl text-ink-muted">
          Choisissez une durée et vos envies : l’itinéraire n’utilise que des lieux réellement enregistrés, avec leur statut de vérification. Un moment
          sans lieu adapté est signalé, jamais comblé.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
