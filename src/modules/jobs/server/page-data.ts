import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { rawQueryString } from "@/modules/search/domain/params";
import { getCityContext } from "@/server/city-context";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { JOB_TYPES } from "../domain/attributes";
import { jobQuery, parseJobFilters } from "../domain/params";
import { JOBS_PAGE_SIZE, listJobsByIds } from "./queries";

type Raw = Record<string, string | string[] | undefined>;

const rowsSchema = z.array(z.object({ id: z.uuid(), total_count: z.number() }));

/** Catégories de l'espace emploi présentes au référentiel (administrable), dans l'ordre des types. */
export async function jobCategories() {
  const categories = await listCategories();
  return {
    categories,
    types: (Object.keys(JOB_TYPES) as (keyof typeof JOB_TYPES)[]).flatMap((slug) => {
      const category = categories.find((item) => item.slug === slug);
      return category ? [category] : [];
    }),
  };
}

export async function loadJobsPage(raw: Raw) {
  await connection();
  const filters = parseJobFilters(raw);
  if (rawQueryString(raw) !== jobQuery(filters)) return { kind: "redirect", query: jobQuery(filters) } as const;
  const { current } = await getCityContext();
  const supabase = createPublicSupabaseClient();
  if (!current.id || !supabase) return { kind: "unconfigured" } as const;
  try {
    const [{ categories, types }, neighborhoods] = await Promise.all([jobCategories(), listNeighborhoods(current.id)]);
    const scope = filters.type ? [filters.type] : types.map((type) => type.slug);
    const neighborhood = neighborhoods.find((item) => item.slug === filters.quartier);
    const { data, error } = await supabase.rpc("search_jobs", {
      p_city: current.id,
      p_categories: categoryIdsWithDescendants(categories, scope),
      p_query: filters.q || undefined,
      p_contract: filters.contrat ?? undefined,
      p_domain: filters.domaine ?? undefined,
      p_experience: filters.experience ?? undefined,
      p_since_days: filters.depuis ?? undefined,
      p_neighborhood: neighborhood?.id,
      p_remote: filters.teletravail ?? undefined,
      p_organization: filters.organisation ?? undefined,
      p_limit: JOBS_PAGE_SIZE,
      p_offset: (filters.page - 1) * JOBS_PAGE_SIZE,
    });
    if (error) throw new Error(`Recherche d’offres impossible : ${error.message}`);
    const rows = rowsSchema.parse(data);
    return { kind: "ok", filters, types, neighborhoods, jobs: await listJobsByIds(rows.map((row) => row.id)), total: rows[0]?.total_count ?? 0, pageSize: JOBS_PAGE_SIZE } as const;
  } catch (error) {
    logger.error("Espace emploi indisponible", { module: "emploi", error });
    return { kind: "error" } as const;
  }
}
