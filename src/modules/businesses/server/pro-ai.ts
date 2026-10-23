import "server-only";
import { z } from "zod";
import { runStructured } from "@/server/ai";
import { faqSchema } from "../domain/pro";

/**
 * Aide FACULTATIVE à la rédaction d'une page professionnelle : présentation et
 * FAQ tirées des seules informations déjà saisies. Le résultat est montré au
 * professionnel, qui le modifie ou l'ignore ; rien n'est enregistré ni publié
 * sans lui, et la page reste relue par l'équipe de modération.
 */

const outputSchema = z.object({
  presentation: z.string(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })),
});

const SYSTEM = `Tu aides un professionnel de San Pedro (Côte d'Ivoire) à rédiger sa page sur une plateforme locale.
Tu n'utilises QUE les informations fournies. Tu n'inventes ni prix, ni horaires, ni années d'expérience, ni certifications, ni garanties, ni références clients, ni adresse.
Écris une présentation claire et sobre (80 à 600 caractères), à la première personne du pluriel, sans superlatif ni promesse.
Propose au plus 5 questions fréquentes dont la réponse découle directement des informations fournies ; si une réponse demanderait une information absente, ne pose pas la question.
Réponds en français.`;

export interface ProFacts {
  name: string;
  category: string | null;
  neighborhood: string | null;
  description: string | null;
  services: string[];
  serviceArea: string | null;
}

export async function generateProText(facts: ProFacts, userId: string) {
  const content = [
    {
      type: "text" as const,
      text: `Informations de la page :\n<page>\n${JSON.stringify(facts, null, 2)}\n</page>`,
    },
  ];
  const result = await runStructured({ feature: "profil_pro", userId, system: SYSTEM, content, schema: outputSchema, maxTokens: 3000 });
  if (!result.ok) return result;
  const faq = faqSchema.catch([]).parse(result.data.faq.slice(0, 5).map((item) => ({ question: item.question.slice(0, 200), answer: item.answer.slice(0, 1000) })));
  return { ok: true as const, presentation: result.data.presentation.trim().slice(0, 3000), faq };
}
