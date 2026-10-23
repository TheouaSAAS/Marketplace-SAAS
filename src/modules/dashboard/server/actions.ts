"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import type { FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { BUSINESSES_CACHE_TAG } from "@/modules/businesses/server/queries";
import { LISTINGS_CACHE_TAG } from "@/modules/listings/server/queries";
import { getSessionUser } from "@/server/auth";
import { NOTIFICATION_CATEGORIES, PRIVACY_OPTIONS, withSiteChannels, type NotificationCategory, type PrivacyOption } from "../domain/dashboard";

async function session(back: string) {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  if (!supabase) throw new Error("Base indisponible");
  return { user, supabase };
}

function failed(error: { code: string; message: string }, fallback: string): FormState {
  if (["23514", "42501"].includes(error.code)) return { status: "error", message: error.message };
  logger.error(fallback, { module: "tableau-de-bord", code: error.code });
  return { status: "error", message: `${fallback}. Réessayez.` };
}

const listingSchema = z.object({ annonce: z.uuid() });

/** Archiver une annonce publiée ou expirée : elle quitte le site (confirmation exigée). */
export async function archiveListingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = listingSchema.safeParse({ annonce: formData.get("annonce") });
  if (!parsed.success) return { status: "error", message: "Annonce introuvable." };
  if (formData.get("confirmer") !== "1") return { status: "error", message: "Cochez la case pour confirmer l’archivage." };
  const { supabase } = await session(href("myListings"));
  const { data, error } = await supabase.from("listings").update({ status: "archived" }).eq("id", parsed.data.annonce).in("status", ["published", "expired"]).select("id");
  if (error) return failed(error, "L’annonce n’a pas pu être archivée");
  if (!data?.length) return { status: "error", message: "Cette annonce ne peut pas être archivée." };
  updateTag(LISTINGS_CACHE_TAG);
  redirect(href("myListings", { query: { statut: "archived", fait: "archivee" } }));
}

/** Renouveler une annonce expirée : elle repasse en relecture avant remise en ligne. */
export async function renewListingAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = listingSchema.safeParse({ annonce: formData.get("annonce") });
  if (!parsed.success) return { status: "error", message: "Annonce introuvable." };
  const { supabase } = await session(href("myListings"));
  const { data, error } = await supabase.from("listings").update({ status: "pending" }).eq("id", parsed.data.annonce).eq("status", "expired").select("id");
  if (error) return failed(error, "L’annonce n’a pas pu être renouvelée");
  if (!data?.length) return { status: "error", message: "Seule une annonce expirée se renouvelle." };
  redirect(href("myListings", { query: { statut: "pending", fait: "renouvelee" } }));
}

/** Disponibilité d'une annonce publiée (sans nouvelle relecture : rien n'y est affirmé de nouveau). */
export async function setAvailabilityAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ annonce: z.uuid(), dispo: z.enum(["available", "unavailable"]) }).safeParse({ annonce: formData.get("annonce"), dispo: formData.get("dispo") });
  if (!parsed.success) return { status: "error", message: "Choix invalide." };
  const { supabase } = await session(href("myListings"));
  const { data, error } = await supabase.from("listings").update({ availability_status: parsed.data.dispo }).eq("id", parsed.data.annonce).eq("status", "published").select("id");
  if (error) return failed(error, "La disponibilité n’a pas pu être enregistrée");
  if (!data?.length) return { status: "error", message: "Seule une annonce publiée change de disponibilité." };
  updateTag(LISTINGS_CACHE_TAG);
  revalidatePath(href("myListings"));
  return { status: "success", message: parsed.data.dispo === "unavailable" ? "Annonce marquée indisponible." : "Annonce de nouveau disponible." };
}

/** Préférences de confidentialité : appliquées sur le site public (règles en base). */
export async function savePrivacyAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { user, supabase } = await session(href("dashboardPrivacy"));
  const values = Object.fromEntries((Object.keys(PRIVACY_OPTIONS) as PrivacyOption[]).map((key) => [key, formData.get(key) === "1"])) as Record<PrivacyOption, boolean>;
  const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, ...values });
  if (error) return failed(error, "Les préférences n’ont pas pu être enregistrées");
  // Les pages publiques en cache relisent les préférences (nom, ancienneté, indexation).
  updateTag(LISTINGS_CACHE_TAG);
  updateTag(BUSINESSES_CACHE_TAG);
  revalidatePath(href("dashboardPrivacy"));
  return { status: "success", message: "Préférences enregistrées : elles s’appliquent tout de suite sur le site public." };
}

export async function saveNotificationPrefsAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const { user, supabase } = await session(href("dashboardNotifications"));
  const enabled = (Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]).filter((key) => formData.get(key) === "1");
  const { data: current } = await supabase.from("user_preferences").select("notification_channels").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, notification_channels: withSiteChannels(current?.notification_channels, enabled) as never });
  if (error) return failed(error, "Les préférences n’ont pas pu être enregistrées");
  revalidatePath(href("dashboardNotifications"));
  return { status: "success", message: "Préférences de notification enregistrées." };
}

export async function markNotificationsReadAction(): Promise<FormState> {
  const { user, supabase } = await session(href("dashboardNotifications"));
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (error) return failed(error, "Les notifications n’ont pas pu être marquées comme lues");
  revalidatePath(href("dashboardNotifications"));
  revalidatePath(href("dashboard"));
  return { status: "success", message: "Toutes les notifications sont marquées comme lues." };
}
