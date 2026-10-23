import { applyUnsubscribe, readUnsubscribeToken } from "@/modules/notifications/server/unsubscribe";

/**
 * Désabonnement en un clic depuis la messagerie (RFC 8058, en-tête
 * « List-Unsubscribe-Post »). POST uniquement : un simple aperçu du lien ne
 * désabonne pas.
 */
export async function POST(request: Request) {
  const target = readUnsubscribeToken(new URL(request.url).searchParams.get("jeton"));
  if (!target) return Response.json({ error: "Lien invalide." }, { status: 400 });
  if (!(await applyUnsubscribe(target))) return Response.json({ error: "Désabonnement momentanément impossible." }, { status: 503 });
  return Response.json({ ok: true });
}
