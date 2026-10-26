"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { href } from "@/config/routes";
import { isStaff } from "@/domain/roles";
import { fieldErrorsFrom, formValues, type FormState } from "@/lib/form-state";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { slugify } from "@/modules/admin/domain/categories";
import { getCityContext } from "@/server/city-context";
import { getCurrentAccount, getSessionUser } from "@/server/auth";
import type { Database } from "@/types/database";
import { EVENTS_CACHE_TAG } from "./queries";
import { closedFeatureMessage, isFeatureEnabled } from "@/server/features";

const SHOWN_CODES = ["23514", "42501", "CP429"];

const read = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
};

async function signedIn(back: string) {
  const user = await getSessionUser();
  if (!user) redirect(href("login", { query: { suivant: back } }));
  const supabase = await createSessionSupabaseClient();
  return supabase ? { user, supabase } : null;
}

/** San Pedro est à l'heure UTC toute l'année : « AAAA-MM-JJTHH:MM » saisi = heure locale = UTC. */
function localDateTime(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Favori : liste privée ; il permet aussi les rappels et les avis de report ou d'annulation. */
export async function toggleEventFavoriteAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const back = safeRedirectPath(formData.get("retour"), href("events"));
  const id = z.uuid().safeParse(formData.get("evenement"));
  if (!id.success) return { status: "error", message: "Événement introuvable." };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Favoris momentanément indisponibles." };
  const { error } =
    formData.get("actif") === "1"
      ? await session.supabase.from("favorites").delete().eq("user_id", session.user.id).eq("event_id", id.data)
      : await session.supabase.from("favorites").insert({ user_id: session.user.id, event_id: id.data });
  if (error && error.code !== "23505") {
    logger.error("Favori non enregistré", { module: "evenements", code: error.code });
    return { status: "error", message: "Le favori n’a pas pu être enregistré. Réessayez." };
  }
  revalidatePath(back);
  return { status: "success" };
}

const messageSchema = z.object({
  evenement: z.uuid(),
  message: z.string().trim().min(2, "Écrivez votre message.").max(4000, "4 000 caractères au maximum."),
});

/** Message à l'organisateur par la messagerie interne (aucune coordonnée échangée). */
export async function contactOrganizerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!isFeatureEnabled("messaging")) return { status: "error", message: closedFeatureMessage("messaging") };
  const back = safeRedirectPath(formData.get("retour"), href("events"));
  const parsed = messageSchema.safeParse({ evenement: formData.get("evenement"), message: formData.get("message") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const session = await signedIn(back);
  if (!session) return { status: "error", message: "Messagerie momentanément indisponible.", values: formValues(formData) };
  const { data, error } = await session.supabase.rpc("start_event_conversation", { p_event: parsed.data.evenement, p_body: parsed.data.message });
  if (error || !data) {
    if (error && SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Message à l'organisateur non envoyé", { module: "evenements", code: error?.code });
    return { status: "error", message: "Le message n’a pas pu être envoyé. Réessayez.", values: formValues(formData) };
  }
  redirect(href("messageThread", { params: { id: String(data) } }));
}

const scheduleSchema = z.object({
  evenement: z.uuid(),
  action: z.enum(["reporter", "annuler"]),
  motif: z.string().trim().min(5, "Expliquez le changement (5 caractères au moins) : il est affiché au public.").max(500),
  debut: z.string().optional(),
  fin: z.string().optional(),
});

/** Report ou annulation : l'événement reste publié avec son nouveau statut (règles en base). */
export async function changeScheduleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = scheduleSchema.safeParse({
    evenement: read(formData, "evenement"),
    action: read(formData, "action"),
    motif: read(formData, "motif"),
    debut: read(formData, "debut"),
    fin: read(formData, "fin"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const startsAt = localDateTime(parsed.data.debut);
  if (parsed.data.action === "reporter" && !startsAt) return { status: "error", fieldErrors: { debut: "Indiquez la nouvelle date et l’heure." }, values: formValues(formData) };
  const session = await signedIn(href("myEvents"));
  if (!session) return { status: "error", message: "Service momentanément indisponible." };
  const args = {
    p_event: parsed.data.evenement,
    p_action: parsed.data.action,
    p_note: parsed.data.motif,
    p_starts_at: startsAt?.toISOString() ?? null,
    p_ends_at: localDateTime(parsed.data.fin)?.toISOString() ?? null,
  } as unknown as Database["public"]["Functions"]["change_event_schedule"]["Args"];
  const { error } = await session.supabase.rpc("change_event_schedule", args);
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Changement de programme non enregistré", { module: "evenements", code: error.code });
    return { status: "error", message: "Le changement n’a pas pu être enregistré.", values: formValues(formData) };
  }
  updateTag(EVENTS_CACHE_TAG);
  revalidatePath(href("myEvents"));
  return {
    status: "success",
    message: parsed.data.action === "annuler" ? "Événement annulé : la fiche l’indique avec votre motif." : "Événement reporté : la fiche indique la date initiale et la nouvelle.",
  };
}

const proposalSchema = z
  .object({
    titre: z.string().trim().min(5, "5 caractères au moins.").max(120, "120 caractères au maximum."),
    description: z.string().trim().min(20, "Décrivez l’événement (20 caractères au moins).").max(10000),
    categorie: z.uuid({ error: "Choisissez une catégorie." }),
    debut: z.string({ error: "Indiquez la date et l’heure de début." }),
    fin: z.string().optional(),
    quartier: z.uuid().optional(),
    adresse: z.string().trim().max(200).optional(),
    organisateur: z.string().trim().min(2, "Indiquez l’organisateur.").max(120),
    gratuit: z.literal("1").optional(),
    prix_min: z.coerce.number().int().min(0).max(100_000_000).optional(),
    prix_max: z.coerce.number().int().min(0).max(100_000_000).optional(),
    billetterie: z.url({ protocol: /^https$/, error: "Adresse https attendue." }).optional(),
    telephone: z.string().trim().max(30).optional(),
    email: z.email("Adresse e-mail invalide.").optional(),
  })
  .refine((value) => !(value.gratuit && (value.prix_min !== undefined || value.prix_max !== undefined)), {
    message: "Un événement gratuit n’a pas de prix.",
    path: ["prix_min"],
  });

/** Proposition d'un événement : créé « en attente », publié seulement après modération (règle en base). */
export async function proposeEventAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const fields = ["titre", "description", "categorie", "debut", "fin", "quartier", "adresse", "organisateur", "gratuit", "prix_min", "prix_max", "billetterie", "telephone", "email"] as const;
  const parsed = proposalSchema.safeParse(Object.fromEntries(fields.map((name) => [name, read(formData, name)])));
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs.", fieldErrors: fieldErrorsFrom(parsed.error), values: formValues(formData) };
  const data = parsed.data;
  const startsAt = localDateTime(data.debut);
  const endsAt = localDateTime(data.fin);
  if (!startsAt || startsAt.getTime() <= Date.now()) return { status: "error", fieldErrors: { debut: "Indiquez une date à venir." }, values: formValues(formData) };
  if (endsAt && endsAt < startsAt) return { status: "error", fieldErrors: { fin: "La fin doit suivre le début." }, values: formValues(formData) };

  const session = await signedIn(href("eventPropose"));
  if (!session) return { status: "error", message: "Service momentanément indisponible.", values: formValues(formData) };
  const { current } = await getCityContext();
  if (!current.id) return { status: "error", message: "Service momentanément indisponible.", values: formValues(formData) };
  const slug = `${slugify(data.titre).slice(0, 60) || "evenement"}-${startsAt.toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 4)}`;
  const { error } = await session.supabase.from("events").insert({
    organizer_id: session.user.id,
    slug,
    title: data.titre,
    description: data.description,
    category_id: data.categorie,
    city_id: current.id,
    neighborhood_id: data.quartier ?? null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt?.toISOString() ?? null,
    address_text: data.adresse ?? null,
    organizer_name: data.organisateur,
    is_free: data.gratuit === "1",
    price_min: data.prix_min ?? null,
    price_max: data.prix_max ?? null,
    ticket_url: data.billetterie ?? null,
    contact_phone: data.telephone ?? null,
    contact_email: data.email ?? null,
    status: "pending",
  });
  if (error) {
    if (SHOWN_CODES.includes(error.code)) return { status: "error", message: error.message, values: formValues(formData) };
    logger.error("Proposition d'événement non enregistrée", { module: "evenements", code: error.code });
    return { status: "error", message: "La proposition n’a pas pu être enregistrée.", values: formValues(formData) };
  }
  redirect(href("myEvents", { query: { propose: "1" } }));
}

const moderationSchema = z
  .object({
    evenement: z.uuid(),
    decision: z.enum(["publier", "refuser"]),
    motif: z.string().trim().max(500).optional(),
  })
  .refine((value) => value.decision === "publier" || (value.motif?.length ?? 0) >= 5, { message: "Motivez le refus (5 caractères au moins).", path: ["motif"] });

/** Décision de modération (équipe) ; l'organisateur est notifié par la base. */
export async function moderateEventAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = moderationSchema.safeParse({ evenement: read(formData, "evenement"), decision: read(formData, "decision"), motif: read(formData, "motif") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const account = await getCurrentAccount();
  if (!account || !isStaff(account.role)) return { status: "error", message: "Décision réservée à l’équipe de modération." };
  const supabase = await createSessionSupabaseClient();
  if (!supabase) return { status: "error", message: "Service momentanément indisponible." };
  const publish = parsed.data.decision === "publier";
  const { data, error } = await supabase
    .from("events")
    .update(publish ? { status: "published" } : { status: "rejected", rejection_reason: parsed.data.motif })
    .eq("id", parsed.data.evenement)
    .eq("status", "pending")
    .select("id");
  if (error || !data?.length) {
    if (error) logger.error("Décision de modération non enregistrée", { module: "evenements", code: error.code });
    return { status: "error", message: error && SHOWN_CODES.includes(error.code) ? error.message : "Décision impossible (déjà traitée ?)." };
  }
  updateTag(EVENTS_CACHE_TAG);
  redirect(href("adminEvents", { query: { decision: publish ? "publie" : "refuse" } }));
}
