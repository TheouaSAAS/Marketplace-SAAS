# Déploiement

État : **non déployé**. Ce document sera complété en phase 6 ; il fixe dès maintenant les principes.

## Environnements

| Environnement | Base | Usage |
| --- | --- | --- |
| Développement | `.env.local` + projet Supabase de développement | Poste local |
| Test (préproduction) | Projet Supabase distinct | Validation avant mise en ligne |
| Production | Projet Supabase de production | Public |

Ne jamais pointer un environnement de développement sur la base de production.

## Hébergement

Next.js 16 avec Cache Components se déploie sur Vercel (le plus simple) ou en auto-hébergement Node.js (`npm run build && npm start`). La géolocalisation exige **HTTPS** (contexte sécurisé) : obligatoire en test et en production.

## Variables d'environnement

Voir `.env.example`. Les variables `NEXT_PUBLIC_*` sont intégrées au build : les définir avant `npm run build`. `SUPABASE_SECRET_KEY`, `AI_API_KEY` et `PAYMENT_*` uniquement dans le gestionnaire de secrets de l'hébergeur.

## Avant chaque mise en production

1. `npm run check` vert.
2. Nouvelles migrations appliquées d'abord en préproduction.
3. Sauvegarde de la base vérifiée.
4. `SMOKE_BASE_URL=https://… npm run smoke` sur l'environnement déployé.
