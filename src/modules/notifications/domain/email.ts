import { createHmac, timingSafeEqual } from "node:crypto";
import { NOTIFICATION_CATEGORIES, type NotificationCategory } from "@/modules/dashboard/domain/dashboard";

/**
 * E-mails de notification : texte sobre, aucun contenu privé (jamais le texte
 * d'un message, jamais de coordonnées), un lien vers le site, un lien de
 * désabonnement de la catégorie valable sans connexion.
 */

/** Miroir de `public.notification_category`. */
export function categoryOf(type: string): NotificationCategory | null {
  if (["annonce", "page_pro", "moderation", "revendication", "verification"].includes(type)) return "decisions";
  return type in NOTIFICATION_CATEGORIES ? (type as NotificationCategory) : null;
}

export interface EmailNotification {
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  displayName: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Lien interne seulement : une adresse externe ou mal formée renvoie à l'accueil. */
export function internalUrl(siteUrl: string, link: string | null): string {
  const base = siteUrl.replace(/\/$/, "");
  return link && link.startsWith("/") && !link.startsWith("//") ? `${base}${link}` : `${base}/`;
}

export function renderEmail(notification: EmailNotification, { siteUrl, siteName, unsubscribeUrl, preferencesUrl }: { siteUrl: string; siteName: string; unsubscribeUrl: string; preferencesUrl: string }): RenderedEmail {
  const url = internalUrl(siteUrl, notification.link);
  const category = categoryOf(notification.type);
  const greeting = notification.displayName ? `Bonjour ${notification.displayName},` : "Bonjour,";
  const why = category ? `Vous recevez cet e-mail pour la catégorie « ${NOTIFICATION_CATEGORIES[category].label} ».` : "Vous recevez cet e-mail pour une notification de votre compte.";
  const subject = `${notification.title} — ${siteName}`.slice(0, 160);
  const text = [
    greeting,
    "",
    notification.title,
    ...(notification.body ? [notification.body] : []),
    "",
    `Voir sur ${siteName} : ${url}`,
    "",
    "—",
    why,
    `Ne plus recevoir ces e-mails : ${unsubscribeUrl}`,
    `Gérer vos préférences : ${preferencesUrl}`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p><strong>${escapeHtml(notification.title)}</strong></p>`,
    notification.body ? `<p>${escapeHtml(notification.body)}</p>` : "",
    `<p><a href="${escapeHtml(url)}">Voir sur ${escapeHtml(siteName)}</a></p>`,
    `<hr><p style="font-size:12px;color:#555">${escapeHtml(why)}<br>`,
    `<a href="${escapeHtml(unsubscribeUrl)}">Ne plus recevoir ces e-mails</a> · <a href="${escapeHtml(preferencesUrl)}">Gérer vos préférences</a></p>`,
  ].join("\n");
  return { subject, text, html };
}

// -----------------------------------------------------------------------------
// Désabonnement sans connexion : jeton signé (personne + catégorie).
// -----------------------------------------------------------------------------
const signature = (secret: string, payload: string) => createHmac("sha256", secret).update(`desabonnement|${payload}`).digest("base64url");

export function createUnsubscribeToken(secret: string, userId: string, category: NotificationCategory | "tout"): string {
  const payload = Buffer.from(`${userId}|${category}`).toString("base64url");
  return `${payload}.${signature(secret, payload)}`;
}

export function verifyUnsubscribeToken(secret: string, token: string): { userId: string; category: NotificationCategory | "tout" } | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(signature(secret, payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [userId, category] = Buffer.from(payload, "base64url").toString().split("|");
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId) || !category) return null;
  if (category !== "tout" && !(category in NOTIFICATION_CATEGORIES)) return null;
  return { userId, category: category as NotificationCategory | "tout" };
}
