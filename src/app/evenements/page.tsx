import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Map as MapIcon, Plus } from "lucide-react";
import { href } from "@/config/routes";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Select } from "@/components/ui/form-controls";
import { PageNav } from "@/components/ui/page-nav";
import { Skeleton } from "@/components/ui/spinner";
import { EventCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { dayKey, monthGrid, monthKey, shiftMonth } from "@/modules/events/domain/calendar";
import { EVENT_PRICES, EVENT_WHEN, eventQuery, type EventFilters } from "@/modules/events/domain/params";
import { loadEventsPage } from "@/modules/events/server/page-data";
import type { EventCardData } from "@/modules/events/server/queries";

export const metadata: Metadata = {
  title: "Événements à San Pedro",
  description: "Concerts, sport, formations, rencontres professionnelles : l’agenda de San Pedro, avec les reports et annulations signalés.",
};

type Raw = Record<string, string | string[] | undefined>;

const DAY_TITLE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const MONTH_TITLE = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const link = (filters: EventFilters, change: Partial<EventFilters>) => {
  const query = eventQuery({ ...filters, page: 1, ...change });
  return query ? `${href("events")}?${query}` : href("events");
};

function Filters({ filters, categories, neighborhoods }: { filters: EventFilters; categories: { slug: string; name: string }[]; neighborhoods: { slug: string; name: string }[] }) {
  return (
    <Form action={href("events")} className="grid gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Filtres de l’agenda">
      {filters.vue === "calendrier" && <input type="hidden" name="vue" value="calendrier" />}
      {filters.mois && <input type="hidden" name="mois" value={filters.mois} />}
      {filters.vue === "liste" && (
        <Field label="Quand">
          {(props) => (
            <Select {...props} name="quand" defaultValue={filters.quand ?? ""}>
              <option value="">À venir</option>
              {Object.entries(EVENT_WHEN).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Field label="Prix">
        {(props) => (
          <Select {...props} name="prix" defaultValue={filters.prix ?? ""}>
            <option value="">Tous</option>
            {Object.entries(EVENT_PRICES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Catégorie">
        {(props) => (
          <Select {...props} name="categorie" defaultValue={filters.categorie ?? ""}>
            <option value="">Toutes</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      {neighborhoods.length > 0 && (
        <Field label="Quartier">
          {(props) => (
            <Select {...props} name="quartier" defaultValue={filters.quartier ?? ""}>
              <option value="">Toute la ville</option>
              {neighborhoods.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
        Appliquer
      </button>
    </Form>
  );
}

function ByDay({ events, now }: { events: EventCardData[]; now: Date }) {
  const days: [string, EventCardData[]][] = [];
  for (const event of events) {
    // Un événement déjà commencé et encore en cours est rangé à aujourd'hui.
    const key = dayKey(new Date(Math.max(Date.parse(event.starts_at), now.getTime())));
    const last = days.at(-1);
    if (last && last[0] === key) last[1].push(event);
    else days.push([key, [event]]);
  }
  return (
    <div className="flex flex-col gap-6">
      {days.map(([key, items]) => (
        <section key={key} aria-labelledby={`jour-${key}`} className="flex flex-col gap-3">
          <h2 id={`jour-${key}`} className="text-lg font-bold first-letter:uppercase">
            {DAY_TITLE.format(new Date(`${key}T12:00:00Z`))}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((event, index) => (
              <li key={event.id} className="flex [&>article]:flex-1">
                <EventCard event={event} now={now} index={index} href={href("eventDetail", { params: { slug: event.slug } })} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Calendar({ filters, month, events, now }: { filters: EventFilters; month: Date; events: EventCardData[]; now: Date }) {
  const byDay = new Map<string, EventCardData[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.starts_at));
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canGoBack = previous.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  return (
    <section aria-labelledby="mois" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {canGoBack ? (
          <Link href={link(filters, { mois: monthKey(previous) })} className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-sand-100">
            <ChevronLeft aria-hidden className="h-4 w-4" />
            Mois précédent
          </Link>
        ) : (
          <span />
        )}
        <h2 id="mois" className="text-lg font-bold first-letter:uppercase">
          {MONTH_TITLE.format(month)}
        </h2>
        <Link href={link(filters, { mois: monthKey(next) })} className="inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold hover:bg-sand-100">
          Mois suivant
          <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
      <p className="text-xs text-ink-muted">Seuls les événements à venir figurent au calendrier ; les jours passés sont grisés.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] table-fixed border-collapse text-sm">
          <thead>
            <tr>
              {WEEKDAYS.map((day) => (
                <th key={day} scope="col" className="p-1 text-left text-xs font-semibold text-ink-muted">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month, now).map((week) => (
              <tr key={week[0]!.key}>
                {week.map((day) => (
                  <td
                    key={day.key}
                    className={cn("h-24 border border-border p-1 align-top", !day.inMonth && "bg-sand-50 text-ink-subtle", day.isPast && "bg-sand-100 text-ink-subtle")}
                  >
                    <span className={cn("text-xs font-semibold", day.isToday && "rounded-pill bg-brand-600 px-1.5 text-white")}>{day.day}</span>
                    <ul className="mt-1 flex flex-col gap-1">
                      {(byDay.get(day.key) ?? []).map((event) => (
                        <li key={event.id}>
                          <Link
                            href={href("eventDetail", { params: { slug: event.slug } })}
                            className={cn(
                              "block truncate rounded px-1 text-xs hover:underline",
                              event.schedule_status === "cancelled" ? "bg-danger-soft text-danger line-through" : "bg-accent-50 text-accent-800",
                            )}
                          >
                            {TIME.format(new Date(event.starts_at))} {event.title}
                            {event.schedule_status === "cancelled" ? " (annulé)" : event.schedule_status === "postponed" ? " (reporté)" : ""}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function Agenda({ searchParams }: { searchParams: Promise<Raw> }) {
  const data = await loadEventsPage(await searchParams);
  if (data.kind === "redirect") redirect(data.query ? `${href("events")}?${data.query}` : href("events"));
  if (data.kind === "unconfigured") return <Alert tone="warning" title="Agenda indisponible">La base de contenus n’est pas encore configurée.</Alert>;
  if (data.kind === "error") return <ErrorState title="L’agenda est momentanément indisponible" description="Réessayez dans quelques instants." />;
  const now = new Date();
  const { filters } = data;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Affichage" className="flex gap-1">
          <Link
            href={link(filters, { vue: "liste", mois: null })}
            aria-current={filters.vue === "liste" ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold", filters.vue === "liste" ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface")}
          >
            <List aria-hidden className="h-4 w-4" />
            Liste
          </Link>
          <Link
            href={link(filters, { vue: "calendrier", quand: null })}
            aria-current={filters.vue === "calendrier" ? "page" : undefined}
            className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-semibold", filters.vue === "calendrier" ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-surface")}
          >
            <CalendarDays aria-hidden className="h-4 w-4" />
            Calendrier
          </Link>
          <Link href={href("map", { query: { couches: "evenements", quartier: filters.quartier } })} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-surface px-4 text-sm font-semibold">
            <MapIcon aria-hidden className="h-4 w-4" />
            Carte
          </Link>
        </nav>
        <ButtonLink href={href("eventPropose")} variant="secondary" icon={<Plus aria-hidden className="h-4 w-4" />}>
          Proposer un événement
        </ButtonLink>
      </div>
      <Filters key={eventQuery(filters)} filters={filters} categories={data.eventCategories} neighborhoods={data.neighborhoods} />
      {data.month ? (
        <Calendar filters={filters} month={data.month} events={data.events} now={now} />
      ) : data.total === 0 ? (
        <EmptyState
          title="Aucun événement à venir ne correspond"
          description="Aucune programmation n’est inventée : l’agenda ne montre que les événements proposés et vérifiés. Retirez un filtre ou proposez le vôtre."
        />
      ) : (
        <>
          <p className="text-sm text-ink-muted" role="status">
            {data.total} événement{data.total > 1 ? "s" : ""} à venir, du plus proche au plus lointain.
          </p>
          <ByDay events={data.events} now={now} />
          <PageNav page={filters.page} total={data.total} pageSize={data.pageSize} hrefFor={(page) => link(filters, { page })} />
        </>
      )}
    </div>
  );
}

export default function EventsPage({ searchParams }: PageProps<"/evenements">) {
  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Découvrir et sortir", href: href("discover") }, { label: "Événements" }]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Événements à San Pedro</h1>
        <p className="max-w-2xl text-ink-muted">
          Uniquement des événements à venir, du plus proche au plus lointain. Reports et annulations sont signalés ; chaque fiche indique son organisateur et
          sa vérification.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-card" />}>
        <Agenda searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
