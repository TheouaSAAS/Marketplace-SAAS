import type { Metadata } from "next";
import { listMetadata } from "@/lib/seo";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { InfoPage } from "@/components/layout/info-page";

export const metadata: Metadata = listMetadata({
  title: "Contact",
  description: `Contacter l’équipe de ${SITE.name}.`,
  path: "/contact",
  searchParams: {},
});

export default function ContactPage() {
  const { email, whatsapp } = SITE.contact;
  return (
    <InfoPage title="Contact" intro="Une question, une suggestion, une information à corriger ? Écrivez-nous.">
      {email || whatsapp ? (
        <div className="flex flex-wrap gap-3">
          {email && (
            <a href={`mailto:${email}`} className={buttonClasses({ size: "lg" })}>
              <Mail aria-hidden className="h-5 w-5" /> {email}
            </a>
          )}
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp.replace(/[^\d]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses({ variant: "secondary", size: "lg" })}
            >
              <MessageCircle aria-hidden className="h-5 w-5" /> WhatsApp
            </a>
          )}
        </div>
      ) : (
        <Alert tone="warning" title="Coordonnées en cours de mise en place">
          L’adresse de contact officielle n’est pas encore publiée. Elle apparaîtra ici dès qu’elle sera disponible.
        </Alert>
      )}
      <section>
        <h2>Avant d’écrire</h2>
        <ul>
          <li>
            Les réponses aux questions fréquentes sont dans l’<Link href={href("help")} className="font-semibold text-brand-700 underline">aide</Link>.
          </li>
          <li>
            Pour une annonce ou une fiche problématique, utilisez de préférence{" "}
            <Link href={href("report")} className="font-semibold text-brand-700 underline">le signalement</Link> : il arrive
            directement à la modération.
          </li>
          <li>Ne transmettez jamais de mot de passe ni de code de paiement, à personne.</li>
        </ul>
      </section>
    </InfoPage>
  );
}
