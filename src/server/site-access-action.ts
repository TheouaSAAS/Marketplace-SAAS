"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { href } from "@/config/routes";
import { safeRedirectPath } from "@/modules/accounts/domain/schemas";
import { SITE_ACCESS_COOKIE, SITE_ACCESS_MAX_AGE, sameFingerprint, siteAccessFingerprint } from "@/lib/site-access";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "./rate-limit";

/** Saisie du code d'accès réservé : cookie d'empreinte, puis retour à la page demandée. */
export async function enterSiteAction(formData: FormData): Promise<void> {
  const next = safeRedirectPath(formData.get("suivant"), "/");
  const expected = process.env.SITE_ACCESS_CODE || undefined;
  if (!expected) redirect(next);
  if (!(await consumeRateLimit("siteAccess"))) redirect(href("siteAccess", { query: { suivant: next, erreur: "limite" } }));
  const code = typeof formData.get("code") === "string" ? String(formData.get("code")).trim() : "";
  const [given, wanted] = await Promise.all([siteAccessFingerprint(code), siteAccessFingerprint(expected)]);
  if (!code || !sameFingerprint(given, wanted)) {
    logger.info("Code d'accès refusé", { module: "acces" });
    redirect(href("siteAccess", { query: { suivant: next, erreur: "code" } }));
  }
  (await cookies()).set(SITE_ACCESS_COOKIE, wanted, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    maxAge: SITE_ACCESS_MAX_AGE,
    path: "/",
  });
  redirect(next);
}
