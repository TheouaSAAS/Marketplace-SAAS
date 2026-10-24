import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { href } from "@/config/routes";
import { SITE } from "@/config/site";
import { VerificationBadge } from "@/components/ui/verification";
import { FOOTER_SECTIONS } from "@/config/navigation";
import { LAUNCH_CITY } from "@/domain/city";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/brand/logo";
import { NavItemLink } from "./nav-item-link";

// Évaluée au chargement du module (et non pendant le rendu) : compatible avec le
// pré-rendu statique de Cache Components. Mise à jour à chaque déploiement.
const COPYRIGHT_YEAR = new Date().getFullYear();

function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, "")}`;
}

/** Pied de page commun : navigation secondaire, contact, réseaux sociaux, pages légales. */
export function SiteFooter() {
  const { email, whatsapp } = SITE.contact;

  return (
    <footer className="mt-auto border-t print:hidden border-border bg-surface">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="text-base font-semibold text-brand-800">« {SITE.slogan} »</p>
          <p className="max-w-xs text-sm text-ink-muted">
            Le guide numérique de votre ville. Lancement à {LAUNCH_CITY.name}, puis ouverture progressive dans toute la
            Côte d’Ivoire.
          </p>
          {(email || whatsapp) && (
            <ul className="flex flex-col gap-2 text-sm">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-brand-700">
                    <Mail aria-hidden className="h-4 w-4" /> {email}
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a
                    href={whatsappHref(whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 font-medium hover:text-brand-700"
                  >
                    <MessageCircle aria-hidden className="h-4 w-4" /> WhatsApp
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <nav key={section.title} aria-label={section.title}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">{section.title}</h2>
            <ul className="mt-3 flex flex-col">
              {section.links.map((link) => (
                <li key={link.label}>
                  <NavItemLink link={link} className="flex min-h-10 items-center text-sm font-medium hover:text-brand-700" />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t border-border bg-surface-muted">
        <Container className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4 text-sm text-ink-muted">
          <span className="font-semibold text-ink">Fiabilité des informations :</span>
          <VerificationBadge status="verified" />
          <VerificationBadge status="pending_validation" />
          <VerificationBadge status="placeholder" />
          <Link href={href("verificationPolicy")} className="font-semibold text-brand-700 hover:underline">
            Comment nous vérifions
          </Link>
        </Container>
      </div>

      <div className="border-t border-border">
        <Container className="flex flex-col gap-3 py-5 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {COPYRIGHT_YEAR} {SITE.name}. Tous droits réservés.
          </p>
          {SITE.socials.length > 0 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Réseaux sociaux">
              {SITE.socials.map((social) => (
                <li key={social.label}>
                  <a href={social.href} target="_blank" rel="noopener noreferrer" className="font-medium hover:text-brand-700">
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </div>
    </footer>
  );
}
