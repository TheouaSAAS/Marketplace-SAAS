import type { Metadata } from "next";
import { href } from "@/config/routes";
import { assignableRoles, ROLE_LABELS, USER_ROLES, type UserRole } from "@/domain/roles";
import { formatDate } from "@/lib/format";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { AccountForm, OrganizationForm } from "@/modules/admin/components/back-office-forms";
import { listAccounts, listOrganizations, type AdminAccount, type AdminOrganization } from "@/modules/admin/server/back-office";

export const metadata: Metadata = {
  title: "Comptes et organisations — administration",
  robots: { index: false, follow: false },
};

type Raw = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim().slice(0, 100) : "");

const control = "min-h-11 rounded-control border border-border-strong bg-surface px-3 text-sm";

async function Accounts({ searchParams }: { searchParams: Promise<Raw> }) {
  const account = await teamAccount("adminAccounts", "admin");
  if (!account) return <AccessDenied audience="admin" />;
  const params = await searchParams;
  const query = one(params.q);
  const role = USER_ROLES.find((value) => value === one(params.role));
  const suspended = one(params.etat) === "suspendus" ? true : undefined;
  const orgQuery = one(params.org);
  let accounts: AdminAccount[];
  let organizations: AdminOrganization[];
  try {
    [accounts, organizations] = await Promise.all([listAccounts({ query, role, suspended }), listOrganizations(orgQuery)]);
  } catch (error) {
    logger.error("Comptes indisponibles", { module: "administration", error });
    return <ErrorState title="Comptes momentanément indisponibles" description="Réessayez dans quelques instants." />;
  }
  const assignable = assignableRoles(account.role);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="comptes" className="flex flex-col gap-4">
        <h2 id="comptes" className="text-xl font-bold">
          Comptes
        </h2>
        <form action={href("adminAccounts")} className="flex flex-wrap items-end gap-2" role="search">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Nom, adresse e-mail ou identifiant
            <input name="q" defaultValue={query} className={control} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Rôle
            <select name="role" defaultValue={role ?? ""} className={control}>
              <option value="">Tous</option>
              {USER_ROLES.map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            État
            <select name="etat" defaultValue={suspended ? "suspendus" : ""} className={control}>
              <option value="">Tous</option>
              <option value="suspendus">Suspendus</option>
            </select>
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-control bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
            Rechercher
          </button>
        </form>
        {accounts.length === 0 ? (
          <EmptyState title="Aucun compte trouvé" description="Modifiez la recherche." />
        ) : (
          <ul className="flex flex-col gap-3">
            {accounts.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold break-all">{item.display_name ?? item.email ?? item.id}</h3>
                  <Badge tone="brand">{ROLE_LABELS[item.role as UserRole]}</Badge>
                  {item.is_suspended && <Badge tone="danger">Suspendu</Badge>}
                  {item.reports_against > 0 && <Badge tone="warning">{item.reports_against} signalement(s) visant ses contenus</Badge>}
                </div>
                <p className="text-sm text-ink-muted break-all">
                  {item.email} · inscrit le {formatDate(item.created_at, "short")}
                  {item.last_sign_in_at ? ` · dernière connexion le ${formatDate(item.last_sign_in_at, "short")}` : ""} · {item.listings} annonce(s) · {item.organizations}{" "}
                  organisation(s)
                </p>
                {item.id === account.id ? (
                  <p className="text-sm text-ink-muted">Votre propre compte ne se modifie pas d’ici.</p>
                ) : (
                  <AccountForm accountId={item.id} role={item.role} suspended={item.is_suspended} assignable={assignable} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="organisations" className="flex flex-col gap-4">
        <h2 id="organisations" className="text-xl font-bold">
          Organisations
        </h2>
        <form action={href("adminAccounts")} className="flex flex-wrap items-end gap-2" role="search">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Nom de l’organisation
            <input name="org" defaultValue={orgQuery} className={control} />
          </label>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-control border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-sand-100">
            Rechercher
          </button>
        </form>
        {organizations.length === 0 ? (
          <EmptyState title="Aucune organisation trouvée" description="Modifiez la recherche." />
        ) : (
          <ul className="flex flex-col gap-3">
            {organizations.map((organization) => (
              <li key={organization.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{organization.name}</h3>
                  {organization.is_suspended && <Badge tone="danger">Suspendue</Badge>}
                </div>
                <p className="text-sm text-ink-muted">
                  Créée le {formatDate(organization.created_at, "short")} · {organization.members} membre(s) · {organization.pages} page(s) pro · {organization.listings} annonce(s)
                </p>
                <OrganizationForm organizationId={organization.id} suspended={organization.is_suspended} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminAccountsPage({ searchParams }: PageProps<"/admin/comptes">) {
  return (
    <AdminFrame
      title="Comptes et organisations"
      intro="Un compte suspendu ne peut plus publier, écrire ni contacter. Les rôles d’administration ne s’attribuent que par un superadministrateur. Toute décision exige une raison et figure au journal."
    >
      <Accounts searchParams={searchParams} />
    </AdminFrame>
  );
}
