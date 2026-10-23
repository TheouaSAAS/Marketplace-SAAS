import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { href, ROUTES } from "@/config/routes";
import { ROLE_LABELS } from "@/domain/roles";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { sectionsFor } from "@/modules/admin/domain/back-office";
import { CLAIM_STATUSES } from "@/modules/shops/domain/claims";
import { listMyClaims } from "@/modules/shops/server/claims";
import { listRecentNotifications } from "@/modules/accounts/server/notifications";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import {
  AccountTypeForm,
  ProfileForm,
  SignOutButton,
} from "@/modules/accounts/components/profile-forms";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardBody className="gap-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        {children}
      </CardBody>
    </Card>
  );
}

async function ProfileContent({ searchParams }: Pick<PageProps<"/profil">, "searchParams">) {
  const params = await searchParams;
  const account = await requireAccount(href("profile"));
  const [claims, notifications] = await Promise.all([listMyClaims(account.id).catch(() => []), listRecentNotifications().catch(() => [])]);
  const name = account.displayName ?? account.email ?? "Mon compte";
  const isProfessional = account.role === "professional";

  return (
    <div className="flex flex-col gap-5">
      {params.bienvenue && (
        <Alert tone="success" title="Adresse confirmée, bienvenue !">
          Votre compte est actif. Vous pouvez compléter votre profil ci-dessous.
        </Alert>
      )}
      {account.isSuspended && (
        <Alert tone="danger" title="Compte suspendu">
          Vous ne pouvez plus publier ni écrire de messages. Contactez l’équipe pour en connaître la raison.
        </Alert>
      )}

      <Card>
        <CardBody className="flex-row items-center gap-4">
          <Avatar name={name} src={account.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-bold">{name}</p>
            <p className="truncate text-sm text-ink-muted">{account.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone={account.emailConfirmed ? "success" : "warning"}>
                {account.emailConfirmed ? "E-mail confirmé" : "E-mail à confirmer"}
              </Badge>
              <Badge tone="brand">{ROLE_LABELS[account.role]}</Badge>
            </div>
          </div>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="gap-3">
          <CardTitle className="text-lg">Mon tableau de bord</CardTitle>
          <p className="text-sm text-ink-muted">
            Mes annonces et leurs statistiques, favoris, recherches, messages, signalements, notifications, confidentialité, sécurité et données.
          </p>
          <ButtonLink href={href("dashboard")}>Ouvrir mon tableau de bord</ButtonLink>
        </CardBody>
      </Card>

      <Section title="Mes publications">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(["myListings", "pro", "proPages", "myEvents", "receivedApplications", "myApplications"] as const).map((key) => (
            <li key={key}>
              <Link href={href(key)} className="font-semibold underline">
                {ROUTES[key].label}
              </Link>
            </li>
          ))}
        </ul>
        <ButtonLink href={href("publish")} variant="secondary">
          Publier une annonce
        </ButtonLink>
      </Section>

      <Section title="Informations publiques">
        <ProfileForm displayName={account.displayName ?? ""} />
      </Section>

      <Section title="Type de compte">
        {account.role === "user" && (
          <AccountTypeForm
            target="professionnel"
            label="Passer en compte professionnel"
            description="Pour les commerces, artisans, agences et organisateurs : vitrine, publications multiples, équipe. Votre page publique ne sera visible qu’après avoir complété votre profil et passé la modération."
          />
        )}
        {isProfessional && (
          <AccountTypeForm
            target="particulier"
            label="Revenir à un compte particulier"
            description="Possible si vous n’êtes propriétaire d’aucune organisation."
          />
        )}
        {!["user", "professional"].includes(account.role) && (
          <p className="text-sm text-ink-muted">Compte d’équipe : le type est géré par l’administration.</p>
        )}
        {sectionsFor(account.role).length > 0 && (
          <ButtonLink href={href("admin")}>Ouvrir l’administration</ButtonLink>
        )}
      </Section>

      {notifications.length > 0 && (
        <Section title="Notifications récentes">
          <ul className="flex flex-col gap-2 text-sm">
            {notifications.map((notification) => (
              <li key={notification.id} className="flex flex-col">
                {notification.link?.startsWith("/") && !notification.link.startsWith("//") ? (
                  <Link className="font-semibold underline" href={notification.link}>
                    {notification.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{notification.title}</span>
                )}
                <span className="text-xs text-ink-muted">
                  {formatDate(notification.created_at)}
                  {notification.body ? ` · ${notification.body}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Mes événements">
        <p className="text-sm text-ink-muted">Proposez un événement, suivez sa modération, reportez-le ou annulez-le.</p>
        <ButtonLink href={href("myEvents")} variant="secondary">
          Gérer mes événements
        </ButtonLink>
      </Section>

      {claims.length > 0 && (
        <Section title="Mes revendications">
          <ul className="flex flex-col gap-2 text-sm">
            {claims.map((claim) => (
              <li key={claim.id}>
                <Link className="font-semibold underline" href={claim.target.href}>
                  {claim.target.name}
                </Link>{" "}
                · {CLAIM_STATUSES[claim.status]}
                {claim.decision_note && <span className="text-ink-muted"> · « {claim.decision_note} »</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="sm:hidden">
        <SignOutButton />
      </div>
    </div>
  );
}

export default function ProfilePage({ searchParams }: PageProps<"/profil">) {
  return (
    <Container className="max-w-3xl py-8 sm:py-12">
      <h1 className="mb-6 text-3xl font-extrabold">Mon profil</h1>
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <ProfileContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
