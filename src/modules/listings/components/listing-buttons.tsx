"use client";

import { useActionState, useState } from "react";
import { Check, Heart, Link2, Share2, ThumbsUp } from "lucide-react";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { toggleFavoriteAction } from "../server/favorite-action";
import { toggleLikeAction } from "../server/like-action";

const ROUND = "inline-flex h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors disabled:opacity-60";

/** Favori : liste privée. Sans compte, le clic mène à la connexion puis revient ici. */
export function FavoriteButton({ listingId, active, back, title }: { listingId: string; active: boolean; back: string; title?: string }) {
  const [state, action, pending] = useActionState(toggleFavoriteAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="annonce" value={listingId} />
      <input type="hidden" name="retour" value={back} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={cn(ROUND, active ? "border-accent-600 bg-accent-50 text-accent-800" : "border-border-strong bg-surface hover:bg-sand-100")}
      >
        <Heart aria-hidden className={cn("h-4 w-4", active && "fill-current")} />
        {active ? "Dans mes favoris" : "Ajouter aux favoris"}
        {/* Dans une liste, le titre distingue les boutons pour les lecteurs d'écran. */}
        {title && <span className="sr-only"> : {title}</span>}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** « J'aime » : seul le total est public. */
export function LikeButton({ listingId, liked, count, back }: { listingId: string; liked: boolean; count: number; back: string }) {
  const [state, action, pending] = useActionState(toggleLikeAction, INITIAL_FORM_STATE);
  return (
    <form action={action}>
      <input type="hidden" name="annonce" value={listingId} />
      <input type="hidden" name="retour" value={back} />
      <input type="hidden" name="aime" value={liked ? "1" : "0"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={liked}
        aria-label={`${liked ? "Je n’aime plus" : "J’aime"} (${count} au total)`}
        className={cn(ROUND, liked ? "border-brand-600 bg-brand-50 text-brand-800" : "border-border-strong bg-surface hover:bg-sand-100")}
      >
        <ThumbsUp aria-hidden className={cn("h-4 w-4", liked && "fill-current")} />
        <span aria-hidden>{count}</span>
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Partage : feuille de partage du téléphone si elle existe, sinon copie du lien. */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Partage annulé : rien à faire.
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Button variant="secondary" onClick={share} icon={copied ? <Check aria-hidden className="h-4 w-4" /> : <Share2 aria-hidden className="h-4 w-4" />}>
      <span aria-live="polite">{copied ? "Lien copié" : "Partager"}</span>
    </Button>
  );
}

/** Lien de partage WhatsApp (le lien de l'annonce seulement, aucune donnée personnelle). */
export function WhatsAppShareLink({ url, title }: { url: string; title: string }) {
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(ROUND, "border-border-strong bg-surface hover:bg-sand-100")}
    >
      <Link2 aria-hidden className="h-4 w-4" />
      Envoyer par WhatsApp
    </a>
  );
}
