import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SITE } from "@/config/site";
import { Logo } from "@/components/brand/logo";
import { Card, CardBody } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { isFeatureEnabled } from "@/server/features";

/**
 * Cadre commun des pages de compte : étroit, centré, lisible au pouce sur
 * mobile, avec la marque et son slogan. `variant="admin"` signale clairement
 * l'accès au back-office (bandeau et couleur d'en-tête distincts).
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  variant = "member",
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "member" | "admin";
}) {
  const available = isFeatureEnabled("accounts");
  const admin = variant === "admin";
  return (
    <Container className="flex justify-center py-8 sm:py-14">
      <div className="flex w-full max-w-md flex-col gap-5">
        <header className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" aria-label={`${SITE.name} — accueil`}>
            <Logo />
          </Link>
          <p className="text-sm font-semibold text-accent-700">« {SITE.slogan} »</p>
          {admin && (
            <p className="inline-flex items-center gap-1.5 rounded-pill bg-brand-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Administration — accès réservé à l’équipe
            </p>
          )}
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {description && <p className="text-ink-muted">{description}</p>}
        </header>
        <Card className={admin ? "border-t-4 border-t-brand-900" : undefined}>
          <CardBody className="gap-5 p-5 sm:p-6">
            {available ? (
              children
            ) : (
              <Alert tone="warning" title="Comptes momentanément indisponibles">
                La consultation du site reste possible sans compte.
              </Alert>
            )}
          </CardBody>
        </Card>
        <div className="flex flex-col items-center gap-2 text-center text-sm">
          {footer}
          <Link href="/" className="inline-flex min-h-11 items-center gap-1 font-semibold text-ink-muted hover:text-ink hover:underline">
            <ArrowLeft aria-hidden className="h-4 w-4" />
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </Container>
  );
}
