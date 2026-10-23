import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { href } from "@/config/routes";
import { formatDateTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NewPasswordForm } from "@/modules/accounts/components/password-forms";
import { DeleteAccountSection, MarketingConsentForm } from "@/modules/accounts/components/profile-forms";
import { PrivacyForm } from "@/modules/dashboard/components/dashboard-forms";
import { getPreferences, listConsents, type ConsentEntry } from "@/modules/dashboard/server/queries";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = { title: "Confidentialité et données" };

const CONSENT_LABELS: Record<string, string> = {
  terms: "Conditions d’utilisation",
  privacy: "Politique de confidentialité",
  marketing_email: "Informations par e-mail",
  marketing_sms: "Informations par SMS",
  geolocation: "Position (« autour de moi »)",
  contact_sharing: "Transmission de mes coordonnées (devis)",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Content() {
  const account = await requireAccount(href("dashboardPrivacy"));
  let data;
  try {
    const [preferences, consents] = await Promise.all([getPreferences(account.id), listConsents(account.id)]);
    data = { preferences, consents };
  } catch (error) {
    logger.error("Confidentialité indisponible", { module: "tableau-de-bord", error });
    return <ErrorState title="Page momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const { preferences, consents } = data;
  const marketing = consents.find((item: ConsentEntry) => item.kind === "marketing_email");
  return (
    <>
      <Section id="public" title="Ce que voit le public">
        <p className="text-sm text-ink-muted">
          Votre nom public se modifie dans{" "}
          <Link href={href("profile")} className="font-semibold underline">
            Mon compte
          </Link>
          . Votre adresse e-mail, votre téléphone et votre position exacte ne sont jamais affichés sans votre accord.
        </p>
        <PrivacyForm
          values={{
            show_public_name: preferences.show_public_name,
            show_member_since: preferences.show_member_since,
            show_listing_count: preferences.show_listing_count,
            search_indexing: preferences.search_indexing,
          }}
        />
      </Section>

      <Section id="consentements" title="Consentements">
        <MarketingConsentForm granted={Boolean(marketing?.granted)} />
        {consents.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold">Historique de mes choix ({consents.length})</summary>
            <ul className="mt-2 flex flex-col gap-0.5 text-ink-muted">
              {consents.map((consent) => (
                <li key={`${consent.kind}-${consent.created_at}`}>
                  {formatDateTime(consent.created_at)} — {CONSENT_LABELS[consent.kind] ?? consent.kind} : {consent.granted ? "accepté" : "refusé"} (version{" "}
                  {consent.document_version})
                </li>
              ))}
            </ul>
          </details>
        )}
      </Section>

      <Section id="securite" title="Sécurité">
        <p className="text-sm text-ink-muted">Changer votre mot de passe. Par sécurité, une connexion récente peut être exigée.</p>
        <NewPasswordForm submitLabel="Changer le mot de passe" />
      </Section>

      <Section id="donnees" title="Mes données">
        <p className="text-sm text-ink-muted">
          Téléchargez l’ensemble des données liées à votre compte (format JSON), ou supprimez définitivement votre compte : vos annonces, favoris,
          messages et préférences sont alors effacés.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={href("profileExport")} className={buttonClasses({ variant: "secondary" })} download>
            <Download aria-hidden className="h-4 w-4" />
            Exporter mes données
          </a>
          <DeleteAccountSection />
        </div>
      </Section>
    </>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Tableau de bord", href: href("dashboard") }, { label: "Confidentialité" }]} />
      <h1 className="text-3xl font-extrabold">Confidentialité et données</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Content />
      </Suspense>
    </>
  );
}
