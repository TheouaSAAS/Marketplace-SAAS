"use server";

import type { FormState } from "@/lib/form-state";
import { applyUnsubscribe, readUnsubscribeToken } from "./unsubscribe";

/** Confirmation du désabonnement depuis la page (un clic, sans connexion). */
export async function unsubscribeAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const target = readUnsubscribeToken(formData.get("jeton"));
  if (!target) return { status: "error", message: "Ce lien de désabonnement n’est pas valide." };
  if (!(await applyUnsubscribe(target))) return { status: "error", message: "Le désabonnement n’a pas pu être enregistré. Réessayez." };
  return { status: "success", message: `C’est fait : vous ne recevrez plus d’e-mails pour « ${target.label} ». Les notifications restent visibles sur le site.` };
}
