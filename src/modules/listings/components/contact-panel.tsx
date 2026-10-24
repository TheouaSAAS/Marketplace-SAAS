"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail, MessageCircle, Phone, Send, ShieldCheck } from "lucide-react";
import { href } from "@/config/routes";
import { INITIAL_FORM_STATE } from "@/lib/form-state";
import { Checkbox } from "@/components/ui/choice-controls";
import { Alert } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form-controls";
import { SubmitButton } from "@/modules/accounts/components/form-parts";
import { CHANNEL_LABELS, contactLink, SAFETY_TIPS, type ContactChannel } from "../domain/presentation";
import { contactSellerAction, revealContactAction } from "../server/contact-actions";

const ICONS: Record<ContactChannel, typeof Phone> = { phone: Phone, whatsapp: MessageCircle, email: Mail };

function RevealContact({ listingId, channel, back }: { listingId: string; channel: ContactChannel; back: string }) {
  const [state, action, pending] = useActionState(revealContactAction, INITIAL_FORM_STATE);
  const Icon = ICONS[channel];
  const value = state.status === "success" ? state.values?.valeur : undefined;

  if (value) {
    return (
      <a
        href={contactLink(channel, value)}
        target={channel === "whatsapp" ? "_blank" : undefined}
        rel={channel === "whatsapp" ? "noopener noreferrer" : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-brand-300 bg-brand-50 px-4 font-semibold text-brand-800"
      >
        <Icon aria-hidden className="h-4 w-4" />
        {CHANNEL_LABELS[channel]} : {value}
      </a>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="annonce" value={listingId} />
      <input type="hidden" name="canal" value={channel} />
      <input type="hidden" name="retour" value={back} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-sand-100 disabled:opacity-60"
      >
        <Icon aria-hidden className="h-4 w-4" />
        Voir le {CHANNEL_LABELS[channel].toLowerCase()}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </form>
  );
}

/**
 * Contacter l'annonceur. La messagerie est le canal par défaut (les
 * coordonnées restent privées) ; un téléphone, un WhatsApp ou un e-mail ne
 * sont proposés que si l'annonceur a choisi de les partager.
 */
export function ContactPanel({
  listingId,
  slug,
  back,
  channels,
  signedIn,
  charterAccepted,
}: {
  listingId: string;
  slug: string;
  back: string;
  channels: ContactChannel[];
  signedIn: boolean;
  /** Charte de confiance déjà acceptée par le visiteur (version en vigueur). */
  charterAccepted: boolean;
}) {
  const [state, action] = useActionState(contactSellerAction, INITIAL_FORM_STATE);
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="annonce" value={listingId} />
        <input type="hidden" name="retour" value={back} />
        {state.status === "error" && state.message && <Alert tone="danger">{state.message}</Alert>}
        <Field label="Votre message à l’annonceur" error={state.fieldErrors?.message} hint={signedIn ? undefined : "Connexion requise pour envoyer un message."}>
          {(props) => (
            <Textarea
              {...props}
              name="message"
              maxLength={4000}
              rows={4}
              defaultValue={state.values?.message ?? "Bonjour, votre annonce est-elle toujours disponible ?"}
            />
          )}
        </Field>
        {signedIn && !charterAccepted && (
          <Checkbox
            name="charte"
            value="1"
            required
            label={
              <span>
                J’accepte la{" "}
                <Link href={href("trustCharter")} className="underline" target="_blank">
                  charte de confiance
                </Link>{" "}
                : aucun paiement avant d’avoir vu le bien ou rencontré la personne.
              </span>
            }
          />
        )}
        <SubmitButton>
          <Send aria-hidden className="h-4 w-4" />
          Envoyer par la messagerie
        </SubmitButton>
      </form>

      {channels.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Coordonnées partagées par l’annonceur</p>
          {channels.map((channel) => (
            <RevealContact key={channel} listingId={listingId} channel={channel} back={back} />
          ))}
          <p className="text-xs text-ink-muted">Affichées aux membres connectés, en nombre limité.</p>
        </div>
      )}

      <details className="rounded-card bg-sand-50 p-3 text-sm">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          <ShieldCheck aria-hidden className="h-4 w-4 text-lagoon-700" />
          Conseils de sécurité
        </summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink-muted">
          {SAFETY_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href={href("trustCharter")} className="underline">
            Charte de confiance
          </Link>
          <Link href={href("listingAgreement", { params: { slug } })} className="underline">
            Accord de transaction à imprimer
          </Link>
        </p>
      </details>
    </div>
  );
}
