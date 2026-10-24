import type { Metadata } from "next";
import { FEATURES } from "@/config/feature-flags";
import { getServerEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { AccessDenied, AdminFrame, teamAccount } from "@/modules/admin/components/admin-frame";
import { AiKillSwitchForm } from "@/modules/admin/components/back-office-forms";
import { knowledgeCounts, listAiUsage, type AiUsageLine } from "@/modules/admin/server/back-office";
import { aiKillSwitchOn } from "@/server/ai";
import { getFeatureStates, requirementLabel } from "@/server/features";

export const metadata: Metadata = {
  title: "Intelligence artificielle — administration",
  robots: { index: false, follow: false },
};

const AI_FEATURES = ["ai_assistant", "ai_search", "ai_publishing", "ai_moderation"] as const;
const USAGE_LABELS: Record<string, string> = {
  publication: "Copilote de publication",
  profil_pro: "Rédaction des pages pro",
  assistant: "Demandez à San Pedro",
  recherche: "Recherche en langage naturel",
  moderation: "Aide à la modération",
};
const KNOWLEDGE_LABELS: Record<string, string> = { guide_article: "Articles du guide", place: "Lieux", neighborhood: "Quartiers", event: "Événements" };

const GUARDS = [
  "Réponses de l’assistant fondées sur les seuls contenus vérifiés, chaque passage cité avec sa source et sa date de vérification ; une réponse sans citation n’est jamais affichée.",
  "Sans passage vérifié : « Je ne dispose pas d’information vérifiée », sans appeler le modèle.",
  "Contenus et questions traités comme des données : les formulations de consignes y sont neutralisées.",
  "Aucune publication, aucun refus, aucune sanction automatique : l’IA propose, une personne décide.",
  "Quotas par personne (questions, recherches, copilote), budget mensuel, interrupteur général.",
  "Journal de consommation réduit au minimum : usage, modèle, volumes, coût estimé — jamais la question, la réponse ni le document.",
  "Sans IA, tout reste utilisable : recherche par règles fixes, passages vérifiés de l’assistant, formulaires manuels.",
];

async function AiControl() {
  const account = await teamAccount("adminAi", "admin");
  if (!account) return <AccessDenied audience="admin" />;
  const env = getServerEnv();
  const states = getFeatureStates();
  let usage: AiUsageLine[];
  let knowledge: Awaited<ReturnType<typeof knowledgeCounts>>;
  let killed: boolean;
  try {
    [usage, knowledge, killed] = await Promise.all([listAiUsage(), knowledgeCounts(), aiKillSwitchOn()]);
  } catch (error) {
    logger.error("Pilotage de l'IA indisponible", { module: "administration", error });
    return <ErrorState title="Pilotage de l’IA momentanément indisponible" description="Réessayez dans quelques instants." />;
  }
  const total = usage.reduce((sum, line) => sum + line.cost_usd, 0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="interrupteur" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
        <h2 id="interrupteur" className="text-xl font-bold">
          Interrupteur général
        </h2>
        <p className="text-sm">
          État : {killed ? <Badge tone="danger">IA coupée partout</Badge> : <Badge tone="success">IA autorisée (selon les fonctions ci-dessous)</Badge>}
        </p>
        <AiKillSwitchForm disabled={killed} />
      </section>

      <section aria-labelledby="fonctions" className="flex flex-col gap-3">
        <h2 id="fonctions" className="text-xl font-bold">
          Fonctions
        </h2>
        <p className="text-sm text-ink-muted">
          Fournisseur : {env.AI_PROVIDER === "none" ? "aucun" : env.AI_PROVIDER} · modèle : {env.AI_MODEL || "par défaut"} · budget mensuel :{" "}
          {env.AI_MONTHLY_BUDGET_EUR !== undefined ? `${env.AI_MONTHLY_BUDGET_EUR} €` : "non plafonné"}. Ces réglages se changent dans la configuration du serveur.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {AI_FEATURES.map((key) => {
            const state = states[key];
            return (
              <li key={key} className="flex flex-col gap-1 rounded-card border border-border bg-surface p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {FEATURES[key].label}
                  <Badge tone={state.enabled && !killed ? "success" : "neutral"}>{state.enabled && !killed ? "Active" : "Inactive"}</Badge>
                </p>
                <p className="text-ink-muted">{FEATURES[key].description}</p>
                {!state.requested && <p>Désactivée dans la configuration.</p>}
                {state.missing.length > 0 && <p>Manque : {state.missing.map(requirementLabel).join(", ")}.</p>}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="consommation" className="flex flex-col gap-3">
        <h2 id="consommation" className="text-xl font-bold">
          Consommation du mois
        </h2>
        {usage.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun appel ce mois-ci.</p>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="group" aria-label="Consommation par usage (défilement horizontal)">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-ink-muted">
                  <th scope="col" className="py-1 pr-3">Usage</th>
                  <th scope="col" className="py-1 pr-3">Appels</th>
                  <th scope="col" className="py-1 pr-3">Jetons (entrée / sortie)</th>
                  <th scope="col" className="py-1">Coût estimé</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((line) => (
                  <tr key={line.feature} className="border-t border-border">
                    <th scope="row" className="py-1 pr-3 font-medium">{USAGE_LABELS[line.feature] ?? line.feature}</th>
                    <td className="py-1 pr-3">{line.calls}</td>
                    <td className="py-1 pr-3">{line.input_tokens} / {line.output_tokens}</td>
                    <td className="py-1">{line.cost_usd.toFixed(2)} $</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-sm">Total estimé : {total.toFixed(2)} $</p>
          </div>
        )}
      </section>

      <section aria-labelledby="connaissances" className="flex flex-col gap-3">
        <h2 id="connaissances" className="text-xl font-bold">
          Base de connaissances de l’assistant
        </h2>
        <p className="text-sm text-ink-muted">
          Alimentée automatiquement par les articles du guide, lieux, quartiers et événements publiés ; seuls les contenus vérifiés (source, date, responsable) sont utilisés.
        </p>
        {knowledge.length === 0 ? (
          <Alert tone="warning">Aucun document : l’assistant répondra qu’il ne dispose pas d’information vérifiée.</Alert>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {knowledge.map((line) => (
              <li key={line.type}>
                {KNOWLEDGE_LABELS[line.type] ?? line.type} : {line.verified} vérifié(s) utilisé(s)
                {line.other > 0 ? `, ${line.other} non vérifié(s) ignoré(s)` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="garde-fous" className="flex flex-col gap-3">
        <h2 id="garde-fous" className="text-xl font-bold">
          Garde-fous
        </h2>
        <ul className="list-disc pl-5 text-sm">
          {GUARDS.map((guard) => (
            <li key={guard}>{guard}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AdminAiPage() {
  return (
    <AdminFrame title="Intelligence artificielle" intro="L’IA est facultative : elle aide, cite ses sources et ne décide jamais. Le site reste entièrement utilisable sans elle.">
      <AiControl />
    </AdminFrame>
  );
}
