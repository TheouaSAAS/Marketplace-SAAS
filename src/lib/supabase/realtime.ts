"use client";

import type { RealtimeClient } from "@supabase/realtime-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

let client: Promise<RealtimeClient | null> | undefined;

/**
 * Client temps réel des canaux publics (diffusion seulement, clé publique).
 * Chargé à la demande, après l'affichage de la page : il ne pèse pas sur le
 * premier chargement. Null si Supabase n'est pas configuré.
 */
function getPublicRealtime(): Promise<RealtimeClient | null> {
  client ??= isSupabaseConfigured()
    ? import("@supabase/realtime-js").then(
        ({ RealtimeClient }) =>
          new RealtimeClient(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL!.replace(/^http/, "ws")}/realtime/v1`, {
            params: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
          }),
      )
    : Promise.resolve(null);
  return client;
}

/** « SUBSCRIBED » quand les messages arrivent ; « UNAVAILABLE » sans temps réel (Supabase non configuré). */
export type TopicStatus = "CONNECTING" | "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED" | "UNAVAILABLE";

interface Listener {
  onMessage: (payload: unknown) => void;
  onStatus: (status: TopicStatus) => void;
}

interface Topic {
  status: TopicStatus;
  listeners: Set<Listener>;
}

const topics = new Map<string, Topic>();

/**
 * Écoute un canal public de diffusion. Un seul abonnement par canal pour toute
 * l'application (le client temps réel réutilise le canal d'un même nom) : les
 * pages s'y inscrivent et s'en retirent sans le fermer. Renvoie la désinscription.
 */
export function watchTopic(name: string, event: string, listener: Listener): () => void {
  let topic = topics.get(name);
  if (!topic) {
    const created: Topic = { status: "CONNECTING", listeners: new Set() };
    topics.set(name, created);
    topic = created;
    const notify = (status: TopicStatus) => {
      created.status = status;
      for (const item of created.listeners) item.onStatus(status);
    };
    getPublicRealtime()
      .then((realtime) => {
        if (!realtime) return notify("UNAVAILABLE");
        realtime
          .channel(name)
          .on("broadcast", { event }, ({ payload }) => {
            for (const item of created.listeners) item.onMessage(payload);
          })
          .subscribe((status) => notify(status as TopicStatus));
      })
      .catch(() => notify("UNAVAILABLE"));
  }
  topic.listeners.add(listener);
  listener.onStatus(topic.status);
  const current = topic;
  return () => {
    current.listeners.delete(listener);
  };
}
