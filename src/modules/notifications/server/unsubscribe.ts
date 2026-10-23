import "server-only";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/modules/dashboard/domain/dashboard";
import { logger } from "@/lib/logger";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "../domain/email";
import { unsubscribeSecret } from "./dispatch";

export type UnsubscribeTarget = { userId: string; category: NotificationCategory | "tout"; label: string };

/** Lien de désabonnement valide ? (aucune donnée lue en base) */
export function readUnsubscribeToken(token: unknown): UnsubscribeTarget | null {
  if (typeof token !== "string" || token.length > 300) return null;
  const target = verifyUnsubscribeToken(unsubscribeSecret(), token);
  if (!target) return null;
  return { ...target, label: target.category === "tout" ? "toutes les notifications" : NOTIFICATION_CATEGORIES[target.category].label };
}

/** Coupe les e-mails d'une catégorie (ou tous) pour la personne du jeton. Les autres réglages sont conservés. */
export async function applyUnsubscribe(target: UnsubscribeTarget): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  if (!admin) return false;
  const { data } = await admin.from("user_preferences").select("notification_channels").eq("user_id", target.userId).maybeSingle();
  const channels = data?.notification_channels && typeof data.notification_channels === "object" && !Array.isArray(data.notification_channels) ? { ...(data.notification_channels as Record<string, unknown>) } : {};
  const key = target.category === "tout" ? "_email" : target.category;
  const previous = channels[key] && typeof channels[key] === "object" ? (channels[key] as Record<string, unknown>) : {};
  channels[key] = target.category === "tout" ? { ...previous, off: true } : { ...previous, email: false };
  const { error } = await admin.from("user_preferences").upsert({ user_id: target.userId, notification_channels: channels as never });
  if (error) {
    logger.error("Désabonnement non enregistré", { module: "notifications", code: error.code });
    return false;
  }
  return true;
}
