import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { after } from "next/server";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { clientIp } from "./rate-limit";

/**
 * Comptage des vues d'une annonce ou d'une page professionnelle : un visiteur
 * distinct par jour, reconnu par une empreinte HMAC du jour (adresse réseau +
 * navigateur) qui ne permet pas de le retrouver et qui est purgée le lendemain.
 * Ne comptent pas : robots connus, préchargements de page, l'annonceur lui-même.
 * L'enregistrement a lieu après l'envoi de la page (aucun délai pour le visiteur).
 */

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|axios/i;

export async function recordContentView(kind: "annonce" | "pro", id: string, { viewerId, ownerIds }: { viewerId: string | null; ownerIds: (string | null)[] }): Promise<void> {
  if (viewerId && ownerIds.includes(viewerId)) return;
  const store = await headers();
  const agent = store.get("user-agent") ?? "";
  const prefetch = store.get("next-router-prefetch") === "1" || /prefetch/i.test(store.get("sec-purpose") ?? store.get("purpose") ?? "");
  if (!agent || BOTS.test(agent) || prefetch) return;
  const admin = createAdminSupabaseClient();
  if (!admin) return;
  const day = new Date().toISOString().slice(0, 10);
  const secret = getServerEnv().SUPABASE_SECRET_KEY ?? "developpement-sans-cle";
  const hash = createHmac("sha256", secret).update([kind, id, await clientIp(), agent, day].join("|")).digest("hex");
  after(async () => {
    const { error } =
      kind === "annonce"
        ? await admin.rpc("record_listing_view", { p_listing: id, p_viewer_hash: hash })
        : await admin.rpc("record_business_view", { p_business: id, p_viewer_hash: hash });
    if (error) logger.warn("Vue non comptée", { module: "statistiques", kind, code: error.code });
  });
}
