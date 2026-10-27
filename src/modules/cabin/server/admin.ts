import "server-only";
import { z } from "zod";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { CABIN_SERVICES, CABIN_STATUSES } from "../domain/cabin";

/** Lectures du back-office de la cabine : réservées aux administrateurs (règles de la base). */

const operationSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  service: z.enum(CABIN_SERVICES),
  network_code: z.string(),
  target_network_code: z.string().nullable(),
  recipient_masked: z.string(),
  amount_xof: z.number(),
  fee_bps: z.number(),
  service_fee_xof: z.number(),
  provider_fee_xof: z.number(),
  total_xof: z.number(),
  mode: z.enum(["demo", "live"]),
  provider_code: z.string().nullable(),
  provider_reference: z.string().nullable(),
  status: z.enum(CABIN_STATUSES),
  status_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  events: z.array(z.object({ from_status: z.enum(CABIN_STATUSES).nullable(), to_status: z.enum(CABIN_STATUSES), source: z.string(), detail: z.string().nullable(), created_at: z.string() })),
});
export type AdminCabinOperation = z.infer<typeof operationSchema>;

export const OPERATION_FILTERS = {
  toutes: { label: "Toutes", statuses: null },
  a_examiner: { label: "À examiner", statuses: ["awaiting_confirmation", "failed", "processing"] },
  en_cours: { label: "En cours", statuses: ["created", "pending", "processing", "awaiting_confirmation"] },
  reussies: { label: "Réussies", statuses: ["succeeded"] },
  terminees: { label: "Échouées, annulées, expirées, remboursées", statuses: ["failed", "cancelled", "expired", "refunded"] },
} as const;
export type OperationFilter = keyof typeof OPERATION_FILTERS;

export async function listCabinOperations(filter: OperationFilter, limit = 100): Promise<AdminCabinOperation[]> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return [];
  let query = supabase
    .from("cabin_operations")
    .select(
      "id, reference, service, network_code, target_network_code, recipient_masked, amount_xof, fee_bps, service_fee_xof, provider_fee_xof, total_xof, mode, provider_code, provider_reference, status, status_reason, created_at, updated_at, events:cabin_operation_events(from_status, to_status, source, detail, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const statuses = OPERATION_FILTERS[filter].statuses;
  if (statuses) query = query.in("status", [...statuses]);
  const { data, error } = await query;
  if (error) throw new Error(`Opérations de la cabine illisibles : ${error.message}`);
  return z
    .array(operationSchema)
    .parse(data)
    .map((operation) => ({ ...operation, events: [...operation.events].sort((a, b) => a.created_at.localeCompare(b.created_at)) }));
}

const providerSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  services: z.array(z.enum(CABIN_SERVICES)),
  mode: z.enum(["demo", "live"]),
  is_active: z.boolean(),
});
const offerSchema = z.object({
  id: z.uuid(),
  network_code: z.string(),
  name: z.string(),
  price_xof: z.number(),
  data_volume: z.string().nullable(),
  validity: z.string().nullable(),
  source: z.string(),
  checked_on: z.string(),
  is_active: z.boolean(),
});
export type AdminCabinProvider = z.infer<typeof providerSchema>;
export type AdminCabinOffer = z.infer<typeof offerSchema>;

/** Prestataires et offres, y compris inactifs (le catalogue public ne montre que les actifs). */
export async function loadCabinAdminConfig(): Promise<{ providers: AdminCabinProvider[]; offers: AdminCabinOffer[] }> {
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { providers: [], offers: [] };
  const [providers, offers] = await Promise.all([
    supabase.from("cabin_providers").select("code, name, description, services, mode, is_active").order("name"),
    supabase.from("cabin_offers").select("id, network_code, name, price_xof, data_volume, validity, source, checked_on, is_active").order("network_code").order("price_xof"),
  ]);
  if (providers.error || offers.error) throw new Error("Configuration de la cabine illisible");
  return { providers: z.array(providerSchema).parse(providers.data), offers: z.array(offerSchema).parse(offers.data) };
}
