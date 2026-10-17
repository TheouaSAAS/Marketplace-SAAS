import { publicEnv } from "@/lib/env";

/**
 * Identité officielle de la marque. Le nom et le slogan doivent être reproduits
 * exactement (cahier des charges §2.1) : ne pas les réécrire ailleurs, importer SITE.
 */
export const SITE = {
  name: "Carrefour des Possibles",
  slogan: "Votre ville, mille opportunités",
  tagline:
    "Découvrez votre ville, trouvez ce qu’il vous faut et saisissez de nouvelles opportunités.",
  description:
    "Le guide numérique de votre ville : bonnes adresses, tourisme, annonces, immobilier, emploi, événements et professionnels locaux. Lancement à San Pedro, en Côte d’Ivoire.",
  locale: "fr_CI",
  url: publicEnv.NEXT_PUBLIC_SITE_URL,
  contact: {
    email: publicEnv.NEXT_PUBLIC_CONTACT_EMAIL,
    whatsapp: publicEnv.NEXT_PUBLIC_CONTACT_WHATSAPP,
  },
  /** Seuls les réseaux renseignés dans l'environnement sont affichés. */
  socials: [
    { label: "Facebook", href: publicEnv.NEXT_PUBLIC_SOCIAL_FACEBOOK },
    { label: "Instagram", href: publicEnv.NEXT_PUBLIC_SOCIAL_INSTAGRAM },
    { label: "TikTok", href: publicEnv.NEXT_PUBLIC_SOCIAL_TIKTOK },
    { label: "LinkedIn", href: publicEnv.NEXT_PUBLIC_SOCIAL_LINKEDIN },
  ].filter((social): social is { label: string; href: string } => Boolean(social.href)),
} as const;
