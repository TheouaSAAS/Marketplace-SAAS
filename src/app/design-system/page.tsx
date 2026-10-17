import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MapPin, Plus } from "lucide-react";
import { CONTENT_STATUSES } from "@/domain/content-status";
import { Badge, SoonBadge, SponsoredBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Alert, EmptyState, ErrorState } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { Skeleton, Spinner } from "@/components/ui/spinner";
import { InteractiveDemos } from "./interactive-demos";

export const metadata: Metadata = {
  title: "Système de design",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  { name: "brand", shades: ["50", "100", "300", "500", "600", "700", "900"] },
  { name: "accent", shades: ["50", "100", "300", "500", "600", "700", "900"] },
  { name: "lagoon", shades: ["50", "100", "500", "600", "700"] },
  { name: "sand", shades: ["50", "100", "200", "300", "500", "700", "900"] },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-8">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Référence visuelle des composants partagés. À consulter après toute modification de globals.css. */
export default function DesignSystemPage() {
  return (
    <Container className="flex flex-col gap-10 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold">Système de design</h1>
        <p className="text-ink-muted">Page interne, non indexée. Source des jetons : src/app/globals.css.</p>
      </header>

      <Section title="Couleurs">
        <div className="flex flex-col gap-4">
          {SWATCHES.map((palette) => (
            <div key={palette.name} className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-sm font-semibold">{palette.name}</span>
              {palette.shades.map((shade) => (
                <span key={shade} className="flex flex-col items-center gap-1 text-xs text-ink-muted">
                  <span
                    className="h-10 w-14 rounded-control border border-border"
                    style={{ backgroundColor: `var(--color-${palette.name}-${shade})` }}
                  />
                  {shade}
                </span>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typographie">
        <p className="text-display">Titre d’affichage</p>
        <p className="text-3xl font-extrabold">Titre de page (h1)</p>
        <p className="text-2xl font-bold">Titre de section (h2)</p>
        <p className="text-base">Texte courant — Plus Jakarta Sans, 16 px. Les accents s’affichent correctement : é è ê à ç ô ï.</p>
        <p className="text-sm text-ink-muted">Texte secondaire, 14 px.</p>
      </Section>

      <Section title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Principal</Button>
          <Button variant="accent" icon={<Plus aria-hidden className="h-4 w-4" />}>
            Publier
          </Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="ghost">Discret</Button>
          <Button variant="danger">Supprimer</Button>
          <Button loading>Envoi</Button>
          <Button disabled>Désactivé</Button>
          <Button size="sm">Petit</Button>
          <Button size="lg" icon={<MapPin aria-hidden className="h-5 w-5" />}>
            Autour de moi
          </Button>
        </div>
      </Section>

      <Section title="Champs de formulaire">
        <form className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Titre de l’annonce" hint="70 caractères maximum." required>
            {(props) => <Input placeholder="Studio meublé à la Cité" {...props} />}
          </Field>
          <Field label="Prix (FCFA)" error="Indiquez un montant positif.">
            {(props) => <Input inputMode="numeric" defaultValue="-5" {...props} />}
          </Field>
          <Field label="Catégorie">
            {(props) => (
              <Select defaultValue="" {...props}>
                <option value="" disabled>
                  Choisir…
                </option>
                <option>Immobilier</option>
                <option>Emploi</option>
              </Select>
            )}
          </Field>
          <Field label="Désactivé">{(props) => <Input disabled value="Non modifiable" readOnly {...props} />}</Field>
          <Field label="Description" className="sm:col-span-2">
            {(props) => <Textarea placeholder="Décrivez votre offre…" {...props} />}
          </Field>
        </form>
      </Section>

      <Section title="Badges et statuts">
        <div className="flex flex-wrap gap-2">
          {CONTENT_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          <SponsoredBadge />
          <SoonBadge />
          <Badge tone="brand">Vérifié</Badge>
        </div>
      </Section>

      <Section title="Cartes">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card interactive>
            <div className="aspect-[4/3] bg-sand-200" />
            <CardBody>
              <div className="flex items-center gap-2">
                <StatusBadge status="published" />
                <SponsoredBadge />
              </div>
              <CardTitle>Carte de contenu</CardTitle>
              <p className="text-sm text-ink-muted">Image, statut, titre et informations essentielles.</p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="items-center justify-center py-10">
              <Spinner size="lg" />
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section title="Messages et états">
        <div className="grid gap-4 md:grid-cols-2">
          <Alert tone="info" title="Information">Message contextuel.</Alert>
          <Alert tone="success" title="Confirmation">Votre annonce a été envoyée.</Alert>
          <Alert tone="warning" title="Géolocalisation indisponible">Choisissez une ville ou un quartier.</Alert>
          <Alert tone="danger" title="Erreur">Le formulaire contient des erreurs.</Alert>
          <EmptyState title="Aucun résultat" description="Élargissez le rayon ou changez de catégorie." />
          <ErrorState offline title="Vous êtes hors ligne" description="Les résultats seront actualisés au retour de la connexion." />
        </div>
      </Section>

      <Section title="Modales, menus et notifications">
        <InteractiveDemos />
      </Section>
    </Container>
  );
}
