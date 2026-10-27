import "server-only";
import { z } from "zod";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { CABIN_SERVICES, CABIN_STATUSES, type CabinService } from "../domain/cabin";
import { liveAdapter } from "./providers";

const serviceSchema = z.object({
  service: z.enum(CABIN_SERVICES),
  label: z.string(),
  description: z.string(),
  is_enabled: z.boolean(),
  fee_bps: z.number(),
  min_amount_xof: z.number(),
  max_amount_xof: z.number(),
  provider_code: z.string().nullable(),
});
const networkSchema = z.object({ code: z.string(), name: z.string(), kind: z.enum(["telecom", "mobile_money", "utility"]), is_active: z.boolean(), sort_order: z.number() });
const providerSchema = z.object({ code: z.string(), name: z.string(), mode: z.enum(["demo", "live"]), is_active: z.boolean(), services: z.array(z.enum(CABIN_SERVICES)) });
const offerSchema = z.object({
  id: z.uuid(),
  network_code: z.string(),
  name: z.string(),
  price_xof: z.number(),
  data_volume: z.string().nullable(),
  validity: z.string().nullable(),
  source: z.string(),
  checked_on: z.string(),
});
const routeSchema = z.object({ source_code: z.string(), target_code: z.string(), provider_code: z.string().nullable(), is_enabled: z.boolean(), note: z.string().nullable() });

export type CabinServiceSettings = z.infer<typeof serviceSchema> & {
  /** « live » seulement si un prestataire réel, actif et réellement intégré couvre le service. */
  mode: "demo" | "live";
  modeReason: string;
};
export type CabinNetwork = z.infer<typeof networkSchema>;
export type CabinOffer = z.infer<typeof offerSchema>;
export type CabinRoute = z.infer<typeof routeSchema> & { live: boolean };

export interface CabinCatalog {
  services: CabinServiceSettings[];
  networks: CabinNetwork[];
  offers: CabinOffer[];
  routes: CabinRoute[];
}

type Provider = z.infer<typeof providerSchema>;

function serviceMode(service: CabinService, providerCode: string | null, providers: Provider[]): { mode: "demo" | "live"; modeReason: string } {
  const provider = providers.find((item) => item.code === providerCode);
  if (!provider) return { mode: "demo", modeReason: "Aucun prestataire n’est connecté à ce service." };
  if (!provider.is_active || provider.mode !== "live") return { mode: "demo", modeReason: `${provider.name} n’est pas activé en mode réel.` };
  if (!provider.services.includes(service)) return { mode: "demo", modeReason: `${provider.name} ne couvre pas ce service.` };
  if (!liveAdapter(provider.code)) return { mode: "demo", modeReason: `L’intégration de ${provider.name} n’est pas installée ou ses clés ne sont pas configurées.` };
  return { mode: "live", modeReason: `Opéré par ${provider.name}.` };
}

/**
 * Configuration publique de la cabine (aucune donnée sensible) : services et
 * frais, réseaux, offres du catalogue, combinaisons de transfert. Lue sans
 * cache : un service suspendu par l'administration l'est aussitôt.
 */
export async function loadCabinCatalog(): Promise<CabinCatalog | null> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return null;
  const [services, networks, providers, offers, routes] = await Promise.all([
    supabase.from("cabin_service_settings").select("service, label, description, is_enabled, fee_bps, min_amount_xof, max_amount_xof, provider_code"),
    supabase.from("cabin_networks").select("code, name, kind, is_active, sort_order").order("sort_order"),
    supabase.from("cabin_providers").select("code, name, mode, is_active, services"),
    supabase.from("cabin_offers").select("id, network_code, name, price_xof, data_volume, validity, source, checked_on").eq("is_active", true).order("price_xof"),
    supabase.from("cabin_transfer_routes").select("source_code, target_code, provider_code, is_enabled, note"),
  ]);
  const failed = [services, networks, providers, offers, routes].find((result) => result.error);
  if (failed?.error) throw new Error(`Configuration de la cabine illisible : ${failed.error.message}`);
  const providerRows = z.array(providerSchema).parse(providers.data);
  const order = new Map(CABIN_SERVICES.map((service, index) => [service, index]));
  return {
    services: z
      .array(serviceSchema)
      .parse(services.data)
      .map((row) => ({ ...row, ...serviceMode(row.service, row.provider_code, providerRows) }))
      .sort((a, b) => order.get(a.service)! - order.get(b.service)!),
    networks: z.array(networkSchema).parse(networks.data),
    offers: z.array(offerSchema).parse(offers.data),
    routes: z
      .array(routeSchema)
      .parse(routes.data)
      .map((route) => {
        const provider = providerRows.find((item) => item.code === route.provider_code);
        return { ...route, live: Boolean(route.is_enabled && provider?.is_active && provider.mode === "live" && liveAdapter(provider.code)) };
      }),
  };
}

const historySchema = z.object({
  reference: z.string(),
  service: z.enum(CABIN_SERVICES),
  status: z.enum(CABIN_STATUSES),
  mode: z.enum(["demo", "live"]),
  recipient_masked: z.string(),
  total_xof: z.number(),
  created_at: z.string(),
});
export type CabinHistoryItem = z.infer<typeof historySchema>;

/** Historique de la personne connectée (règle de la base : ses propres opérations). */
export async function listMyCabinOperations(limit = 10): Promise<CabinHistoryItem[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cabin_operations")
    .select("reference, service, status, mode, recipient_masked, total_xof, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Historique de la cabine illisible : ${error.message}`);
  return z.array(historySchema).parse(data);
}
