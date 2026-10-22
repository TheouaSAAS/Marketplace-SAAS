import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { whenRange } from "@/modules/search/domain/dates";
import { rawQueryString } from "@/modules/search/domain/params";
import { getCityContext } from "@/server/city-context";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { monthStart, shiftMonth } from "../domain/calendar";
import { eventQuery, parseEventFilters, type EventFilters } from "../domain/params";
import { listEventsByIds } from "./queries";

export const EVENTS_PAGE_SIZE = 20;
/** Un mois de calendrier : au plus 200 événements (au-delà, la liste les pagine). */
const CALENDAR_LIMIT = 200;

type Raw = Record<string, string | string[] | undefined>;

const rowsSchema = z.array(z.object({ id: z.uuid(), total_count: z.number() }));

export async function loadEventsPage(raw: Raw) {
  await connection();
  const requested = parseEventFilters(raw);
  if (rawQueryString(raw) !== eventQuery(requested)) return { kind: "redirect", query: eventQuery(requested) } as const;
  const { current } = await getCityContext();
  const supabase = createPublicSupabaseClient();
  if (!current.id || !supabase) return { kind: "unconfigured" } as const;

  const now = new Date();
  const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(current.id)]);
  const root = categories.find((category) => category.slug === "evenements");
  const eventCategories = root ? categories.filter((category) => category.parent_id === root.id) : [];
  const category = eventCategories.find((item) => item.slug === requested.categorie);
  const neighborhood = neighborhoods.find((item) => item.slug === requested.quartier);
  const filters: EventFilters = { ...requested, categorie: category?.slug ?? null, quartier: neighborhood?.slug ?? null };

  // Période : le mois affiché (calendrier) ou le filtre « quand » (liste).
  const month = filters.vue === "calendrier" ? monthStart(filters.mois, now) : null;
  const range = month ? { from: month, to: shiftMonth(month, 1) } : filters.quand ? whenRange(filters.quand, now) : null;

  try {
    const { data, error } = await supabase.rpc("search_events", {
      p_city: current.id,
      p_categories: category ? categoryIdsWithDescendants(categories, [category.slug]) : undefined,
      p_from: range?.from.toISOString(),
      p_to: range?.to.toISOString(),
      p_free: filters.prix ? filters.prix === "gratuit" : undefined,
      p_neighborhood: neighborhood?.id,
      p_query: filters.q || undefined,
      p_limit: month ? CALENDAR_LIMIT : EVENTS_PAGE_SIZE,
      p_offset: month ? 0 : (filters.page - 1) * EVENTS_PAGE_SIZE,
    });
    if (error) throw new Error(`Recherche d’événements impossible : ${error.message}`);
    const rows = rowsSchema.parse(data);
    const events = await listEventsByIds(rows.map((row) => row.id));
    return {
      kind: "ok",
      filters,
      month,
      eventCategories,
      neighborhoods,
      events,
      total: rows[0]?.total_count ?? 0,
      pageSize: EVENTS_PAGE_SIZE,
    } as const;
  } catch (error) {
    logger.error("Agenda indisponible", { module: "evenements", error });
    return { kind: "error" } as const;
  }
}
