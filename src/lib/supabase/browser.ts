"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null | undefined;

/** Client navigateur unique (clé publique, RLS appliquée). Null si Supabase n'est pas configuré. */
export function getBrowserSupabaseClient(): SupabaseClient<Database> | null {
  if (client === undefined) {
    client = isSupabaseConfigured()
      ? createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)
      : null;
  }
  return client;
}
