"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

let client: SupabaseClient | null | undefined;

/** Client navigateur unique (clé publique, RLS appliquée). Null si Supabase n'est pas configuré. */
export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (client === undefined) {
    client = isSupabaseConfigured()
      ? createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
      : null;
  }
  return client;
}
