import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { href } from "@/config/routes";
import { createSessionSupabaseClient } from "@/lib/supabase/server";
import { Container } from "@/components/ui/container";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TEAM_ROLES, type TeamRole } from "@/modules/businesses/domain/pro";
import { AcceptInvitationForm } from "@/modules/businesses/components/pro-forms";
import { requireAccount } from "@/server/auth";

export const metadata: Metadata = {
  title: "Rejoindre une équipe",
  robots: { index: false, follow: false },
  // Le lien secret ne doit jamais partir vers un autre site.
  referrer: "no-referrer",
};

const previewSchema = z.array(z.object({ organization_name: z.string(), role: z.enum(["owner", "admin", "editor", "viewer"]), valid: z.boolean() }));

async function Invitation({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  await requireAccount(href("proInvitation", { params: { jeton } }));
  const invalid = (
    <Alert tone="warning" title="Invitation invalide">
      Ce lien a expiré, a déjà servi ou a été révoqué. Demandez une nouvelle invitation à l’administrateur de l’équipe.
    </Alert>
  );
  if (!/^[0-9a-f]{64}$/.test(jeton)) return invalid;
  const supabase = await createSessionSupabaseClient();
  const { data } = supabase ? await supabase.rpc("organization_invitation_preview", { p_token: jeton }) : { data: [] };
  const preview = previewSchema.catch([]).parse(data)[0];
  if (!preview?.valid) return invalid;
  const role = TEAM_ROLES[preview.role as TeamRole];
  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:p-6">
      <p>
        Vous êtes invité à rejoindre l’équipe <span className="font-bold">{preview.organization_name}</span> avec le rôle{" "}
        <span className="font-bold">{role.label}</span>.
      </p>
      <p className="text-sm text-ink-muted">{role.rights} Votre nom public sera visible des autres membres de l’équipe.</p>
      <AcceptInvitationForm token={jeton} />
    </div>
  );
}

export default function InvitationPage({ params }: PageProps<"/mes-pages-pro/invitation/[jeton]">) {
  return (
    <Container className="flex max-w-2xl flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: "Mes pages professionnelles", href: href("proPages") }, { label: "Invitation" }]} />
      <h1 className="text-3xl font-extrabold">Rejoindre une équipe</h1>
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <Invitation params={params} />
      </Suspense>
    </Container>
  );
}
