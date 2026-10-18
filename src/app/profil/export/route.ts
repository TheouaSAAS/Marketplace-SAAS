import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/server/auth";

/** Export des données personnelles de l'utilisateur connecté (droit d'accès et de portabilité). */
export async function GET() {
  const user = await getSessionUser();
  const supabase = await createSessionSupabaseClient();
  if (!user || !supabase) {
    return NextResponse.json({ error: { code: "unauthenticated", message: "Connectez-vous pour exporter vos données." } }, { status: 401 });
  }
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) {
    logger.error("Export des données impossible", { module: "comptes", code: error.code });
    return NextResponse.json({ error: { code: "internal", message: "L’export a échoué. Réessayez plus tard." } }, { status: 500 });
  }
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mes-donnees-carrefour-des-possibles.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
