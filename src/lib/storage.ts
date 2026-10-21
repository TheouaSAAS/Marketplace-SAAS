import { publicEnv } from "@/lib/env";

/** Adresse publique d'un fichier du bucket `media` (images des contenus publiés). */
export function publicMediaUrl(path: string): string | null {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) return null;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${encoded}`;
}
