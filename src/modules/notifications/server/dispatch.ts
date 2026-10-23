import "server-only";
import { z } from "zod";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listNeighborhoods } from "@/modules/neighborhoods/server/queries";
import { parseSearchParams, toQueryString } from "@/modules/search/domain/params";
import { searchType } from "@/modules/search/server/queries";
import { categoryIdsWithDescendants, listCategories } from "@/server/repositories/categories";
import { sendEmail, sendPush, sendSms, type ChannelOutcome } from "@/server/notification-channels";
import { categoryOf, createUnsubscribeToken, renderEmail } from "../domain/email";

/**
 * Tâche d'envoi (appelée par le planificateur) : alertes de recherches dues,
 * puis file d'envoi. Chaque envoi est réservé avant d'être traité (jamais deux
 * fois), son résultat est enregistré ; un échec est retenté puis abandonné.
 */

function admin() {
  const client = createAdminSupabaseClient();
  if (!client) throw new Error("Clé secrète absente : envoi impossible.");
  return client;
}

export function unsubscribeSecret(): string {
  return getServerEnv().SUPABASE_SECRET_KEY ?? "developpement-sans-cle";
}

const absolute = (path: string) => `${publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${path}`;

export interface DispatchReport {
  processed: number;
  sent: number;
  simulated: number;
  skipped: number;
  failed: number;
}

export async function dispatchDeliveries(limit = 100): Promise<DispatchReport> {
  const supabase = admin();
  const { data, error } = await supabase.rpc("claim_notification_deliveries", { p_limit: limit });
  if (error) throw new Error(`File d'envoi : ${error.code}`);
  const report: DispatchReport = { processed: 0, sent: 0, simulated: 0, skipped: 0, failed: 0 };
  for (const row of data ?? []) {
    let outcome: ChannelOutcome;
    if (row.channel === "email") {
      const category = categoryOf(row.type);
      const token = createUnsubscribeToken(unsubscribeSecret(), row.user_id, category ?? "tout");
      const rendered = renderEmail(
        { type: row.type, title: row.title, body: row.body, link: row.link, displayName: row.display_name },
        {
          siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
          siteName: SITE.name,
          unsubscribeUrl: absolute(href("unsubscribe", { query: { jeton: token } })),
          preferencesUrl: absolute(href("dashboardNotifications")),
        },
      );
      outcome = row.email
        ? await sendEmail({ to: row.email, ...rendered, oneClickUnsubscribeUrl: absolute(`/api/desabonnement?jeton=${encodeURIComponent(token)}`), idempotencyKey: row.delivery_id })
        : { status: "skipped", error: "adresse_absente" };
    } else {
      outcome = row.channel === "push" ? await sendPush() : await sendSms();
    }
    const { error: completeError } = await supabase.rpc("complete_notification_delivery", { p_delivery: row.delivery_id, p_status: outcome.status, p_error: outcome.error });
    if (completeError) logger.error("Résultat d'envoi non enregistré", { module: "notifications", code: completeError.code });
    report.processed += 1;
    report[outcome.status] += 1;
  }
  if (report.failed > 0) logger.warn("Envois en échec (nouvel essai prévu)", { module: "notifications", failed: report.failed });
  return report;
}

// -----------------------------------------------------------------------------
// Alertes de recherches enregistrées (annonces nouvellement publiées)
// -----------------------------------------------------------------------------
const PERIOD_MS = { daily: 24 * 3600_000, weekly: 7 * 24 * 3600_000 } as const;
/** Marge : une tâche lancée quelques minutes plus tôt ne décale pas l'alerte d'un cycle. */
const MARGIN_MS = 30 * 60_000;
const savedSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  query: z.object({ search: z.string().max(2000) }),
  alert_frequency: z.enum(["daily", "weekly"]),
  last_alerted_at: z.string().nullable(),
  created_at: z.string(),
});

export async function runSearchAlerts(now: Date, limit = 100): Promise<{ checked: number; alerted: number }> {
  const supabase = admin();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, query, alert_frequency, last_alerted_at, created_at")
    .in("alert_frequency", ["daily", "weekly"])
    .order("last_alerted_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`Recherches enregistrées : ${error.code}`);
  const due = z
    .array(savedSchema)
    .parse(data)
    .filter((saved) => now.getTime() - new Date(saved.last_alerted_at ?? saved.created_at).getTime() >= PERIOD_MS[saved.alert_frequency] - MARGIN_MS);
  if (due.length === 0) return { checked: 0, alerted: 0 };

  const { data: city } = await supabase.from("cities").select("id").eq("is_default", true).maybeSingle();
  if (!city) return { checked: 0, alerted: 0 };
  const [categories, neighborhoods] = await Promise.all([listCategories(), listNeighborhoods(city.id)]);

  let alerted = 0;
  for (const saved of due) {
    const since = new Date(saved.last_alerted_at ?? saved.created_at);
    const params = { ...parseSearchParams(Object.fromEntries(new URLSearchParams(saved.query.search))), type: "annonces" as const, tri: null, page: 1 };
    const category = params.categorie ? categories.find((item) => item.slug === params.categorie) : undefined;
    const neighborhood = params.quartier ? neighborhoods.find((item) => item.slug === params.quartier) : undefined;
    try {
      const { items } = await searchType(
        {
          cityId: city.id,
          params,
          categoryIds: category ? categoryIdsWithDescendants(categories, [category.slug]) : null,
          neighborhoodId: neighborhood?.id ?? null,
          position: null,
          now,
        },
        "annonces",
        { sort: "recent", limit: 30, offset: 0 },
      );
      const fresh = items.filter((item) => item.type === "annonces" && item.data.published_at && new Date(item.data.published_at) > since).length;
      const title = fresh === 1 ? `1 nouvelle annonce pour « ${saved.name} »` : `${fresh} nouvelles annonces pour « ${saved.name} »`;
      const { data: created } = await supabase.rpc("record_search_alert", {
        p_search: saved.id,
        p_new: fresh,
        p_title: title,
        p_link: `${href("search")}?${toQueryString({ ...params, tri: "recent" })}`,
      });
      if (created) alerted += 1;
    } catch (searchError) {
      logger.warn("Alerte de recherche non calculée", { module: "notifications", error: searchError });
    }
  }
  return { checked: due.length, alerted };
}
