"use server";

import { z } from "zod";
import { isStaff } from "@/domain/roles";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { neutralizeInstructions } from "@/modules/assistant/domain/rag";
import { REPORT_REASONS, type ReportReason } from "@/modules/listings/domain/report-reasons";
import { checkListing } from "@/modules/publishing/domain/rules";
import { runStructured } from "@/server/ai";
import { getCurrentAccount } from "@/server/auth";
import { MODERATION_SYSTEM, moderationSchema, type HintState } from "../domain/moderation-ai";

/**
 * Suggestion de l'IA pour l'équipe de modération (drapeau `ai_moderation`).
 * Elle n'écrit rien : la décision reste prise, motivée et journalisée par une
 * personne, avec les formulaires habituels.
 */
export async function suggestModerationAction(_previous: HintState, formData: FormData): Promise<HintState> {
  const parsed = z.object({ type: z.enum(["annonce", "signalement"]), id: z.uuid() }).safeParse({ type: formData.get("type"), id: formData.get("id") });
  if (!parsed.success) return { status: "error", message: "Demande invalide." };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Réservé à l’équipe de modération." };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service indisponible." };

  let text: string;
  if (parsed.data.type === "annonce") {
    const { data } = await supabase.from("listings").select("title, description, price, price_unit, attributes, category:categories(name)").eq("id", parsed.data.id).maybeSingle();
    if (!data) return { status: "error", message: "Annonce introuvable." };
    const body = `${data.title}\n${data.description}\n${JSON.stringify(data.attributes)}`;
    const hits = checkListing(body).map((hit) => hit.rule);
    text = [
      `Annonce (catégorie : ${data.category?.name ?? "inconnue"}, prix : ${data.price ?? "non indiqué"} ${data.price_unit ?? ""})`,
      `Titre : ${data.title}`,
      `Description : ${data.description}`,
      `Caractéristiques : ${JSON.stringify(data.attributes)}`,
      hits.length > 0 ? `Règles automatiques déclenchées : ${hits.join(" ; ")}` : "Aucune règle automatique déclenchée.",
    ].join("\n");
  } else {
    const { data } = await supabase.rpc("admin_reports", { p_open: true });
    const report = (data ?? []).find((item) => item.id === parsed.data.id);
    if (!report) return { status: "error", message: "Signalement introuvable ou déjà traité." };
    text = [
      `Signalement : ${REPORT_REASONS[report.reason as ReportReason] ?? report.reason}`,
      `Contenu visé (${report.target_type}) : ${report.target_title}`,
      `Précisions du signalant : ${report.details ?? "aucune"}`,
      `Nombre de signalements ouverts sur ce contenu : ${report.target_reports}`,
    ].join("\n");
  }

  const result = await runStructured({
    feature: "moderation",
    userId: account.id,
    system: MODERATION_SYSTEM,
    content: [{ type: "text", text: neutralizeInstructions(text).slice(0, 8000) }],
    schema: moderationSchema,
    maxTokens: 1500,
  });
  if (!result.ok) return { status: "error", message: result.message };
  return { status: "done", suggestion: result.data };
}
