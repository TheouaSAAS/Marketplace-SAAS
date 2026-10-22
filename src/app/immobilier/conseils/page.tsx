import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { href } from "@/config/routes";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/spinner";
import { GuideCard } from "@/components/content/content-cards";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { listGuideArticlesBySection } from "@/modules/guide/server/queries";
import { SAFETY_TIPS } from "@/modules/listings/domain/presentation";
import { getCityContext } from "@/server/city-context";

export const metadata: Metadata = {
  title: "Conseils pour se loger à San Pedro",
  description: "Règles de prudence avant une visite ou un paiement, et articles du guide « Se loger », vérifiés et sourcés.",
};

/** Règles de prudence propres au logement (génériques : aucune donnée locale). */
const HOUSING_TIPS = [
  "Visitez le logement avant de verser quoi que ce soit, idéalement accompagné.",
  "Demandez à voir un justificatif du droit de louer ou de vendre (propriétaire ou mandat de l’agence).",
  "Faites préciser par écrit le loyer, la caution, l’avance demandée et ce qu’ils couvrent, et gardez un reçu pour chaque versement.",
  "Vérifiez sur place l’eau, l’électricité (compteur individuel ou non) et l’accès en saison des pluies.",
  "Méfiez-vous des « frais de visite » ou des frais de dossier demandés avant la visite.",
];

/** Articles administrables de la rubrique « Se loger » du guide (avec source et statut de vérification). */
async function GuideArticles() {
  const { current } = await getCityContext();
  const articles = current.id ? await listGuideArticlesBySection(current.id, "se-loger") : [];
  if (articles.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen aria-hidden className="h-6 w-6" />}
        title="Aucun article publié pour l’instant"
        description="Les articles « Se loger » du guide pratique, rédigés et vérifiés par l’équipe locale avec leurs sources, apparaîtront ici."
      />
    );
  }
  const now = new Date();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article, index) => (
        <li key={article.id} className="flex [&>article]:flex-1">
          <GuideCard article={article} now={now} index={index} />
        </li>
      ))}
    </ul>
  );
}

export default function HousingAdvicePage() {
  return (
    <Container className="flex max-w-5xl flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs items={[{ label: "Immobilier", href: href("realEstate") }, { label: "Conseils" }]} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">Conseils pour se loger</h1>
        <p className="max-w-2xl text-ink-muted">
          Des règles de prudence générales et les articles du guide pratique. Ces conseils ne remplacent pas un avis juridique ou financier.
        </p>
      </div>
      <section aria-labelledby="prudence" className="flex flex-col gap-3 rounded-card border border-lagoon-100 bg-success-soft p-5">
        <h2 id="prudence" className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck aria-hidden className="h-5 w-5 text-lagoon-700" />
          Avant une visite ou un paiement
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {[...HOUSING_TIPS, ...SAFETY_TIPS].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="articles" className="flex flex-col gap-3">
        <h2 id="articles" className="text-xl font-bold">
          Guide pratique : se loger
        </h2>
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-card" />}>
          <GuideArticles />
        </Suspense>
      </section>
    </Container>
  );
}
