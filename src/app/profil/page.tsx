import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Download } from "lucide-react";
import { href } from "@/config/routes";
import { isAdmin, isCurator, ROLE_LABELS } from "@/domain/roles";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { DeletePlanForm } from "@/modules/newcomer/components/plan-actions";
import { answersToSearchParams } from "@/modules/newcomer/domain/answers";
import { getSavedNewcomerAnswers } from "@/modules/newcomer/server/queries";
import { DeleteSavedSearchForm } from "@/modules/search/components/saved-search-forms";
import { listSavedSearches } from "@/modules/search/server/saved";
import { CLAIM_STATUSES } from "@/modules/shops/domain/claims";
import { listMyClaims } from "@/modules/shops/server/claims";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { FormSkeleton } from "@/modules/accounts/components/form-skeleton";
import { NewPasswordForm } from "@/modules/accounts/components/password-forms";
import {
  AccountTypeForm,
  DeleteAccountSection,
  MarketingConsentForm,
  ProfileForm,
  SignOutButton,
} from "@/modules/accounts/components/profile-forms";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
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
  const supabase = await createSessionSupabaseClient();
  const { data: marketing } = (await supabase
    ?.from("consents")
    .select("granted")
    .eq("user_id", account.id)
    .eq("kind", "marketing_email")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) ?? { data: null };

  const [newcomer, savedSearches, claims] = await Promise.all([getSavedNewcomerAnswers(), listSavedSearches(), listMyClaims(account.id).catch(() => [])]);
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
        {isAdmin(account.role) && (
          <ButtonLink href={href("adminCategories")} variant="secondary">
            Gérer les catégories et métiers
          </ButtonLink>
        )}
        {isCurator(account.role) && (
          <ButtonLink href={href("placeClaims")} variant="secondary">
            Examiner les revendications de vitrines
          </ButtonLink>
        )}
        {isCurator(account.role) && (
          <ButtonLink href={href("adminGuide")} variant="secondary">
            Rédiger le guide pratique
          </ButtonLink>
        )}
        {isCurator(account.role) && (
          <ButtonLink href={href("adminNeighborhoods")} variant="secondary">
            Gérer les quartiers et leurs périmètres
          </ButtonLink>
        )}
      </Section>

      <Section title="Sécurité">
        <p className="text-sm text-ink-muted">Changer votre mot de passe. Par sécurité, une connexion récente peut être exigée.</p>
        <NewPasswordForm submitLabel="Changer le mot de passe" />
      </Section>

      <Section title="Communications">
        <MarketingConsentForm granted={Boolean(marketing?.granted)} />
      </Section>

      {claims.length > 0 && (
        <Section title="Mes revendications de vitrines">
          <ul className="flex flex-col gap-2 text-sm">
            {claims.map((claim) => (
              <li key={claim.id}>
                <Link className="font-semibold underline" href={href("placeDetail", { params: { slug: claim.place.slug } })}>
                  {claim.place.name}
                </Link>{" "}
                · {CLAIM_STATUSES[claim.status]}
                {claim.decision_note && <span className="text-ink-muted"> · « {claim.decision_note} »</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Mon parcours « Nouveau à San Pedro ? »">
        {newcomer ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-muted">Enregistré le {formatDate(newcomer.updatedAt)}.</p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink href={`${href("newcomerPlan")}?${answersToSearchParams(newcomer.answers).toString()}`} variant="secondary">
                Voir mon plan
              </ButtonLink>
              <DeletePlanForm returnTo="profil" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink-muted">Aucun parcours enregistré.</p>
            <ButtonLink href={href("newcomer")} variant="secondary">
              Commencer le parcours
            </ButtonLink>
          </div>
        )}
      </Section>

      <Section title="Mes recherches enregistrées">
        {savedSearches.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border">
            {savedSearches.map((saved) => (
              <li key={saved.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link href={`${href("search")}?${saved.query}`} className="block truncate font-semibold text-brand-700 hover:underline">
                    {saved.name}
                  </Link>
                  <p className="text-xs text-ink-muted">Enregistrée le {formatDate(saved.createdAt)}</p>
                </div>
                <DeleteSavedSearchForm id={saved.id} name={saved.name} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">
            Aucune recherche enregistrée. Depuis la{" "}
            <Link href={href("search")} className="font-semibold text-brand-700 underline">
              recherche
            </Link>
            , utilisez « Enregistrer cette recherche ».
          </p>
        )}
      </Section>

      <Section title="Mes données">
        <p className="text-sm text-ink-muted">
          Téléchargez l’ensemble des données liées à votre compte (format JSON), ou supprimez définitivement votre compte.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={href("profileExport")} className={buttonClasses({ variant: "secondary" })} download>
            <Download aria-hidden className="h-4 w-4" />
            Exporter mes données
          </a>
          <DeleteAccountSection />
        </div>
      </Section>

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
