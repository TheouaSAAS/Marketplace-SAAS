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

## Tâches planifiées

- En base (pg_cron) : expiration des annonces, rappels d'événements, relances d'annonces qui expirent, purges (voir `docs/database.md`).
- Sur l'hébergeur : `GET` ou `POST /api/interne/notifications` toutes les 10 minutes, avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (alertes de recherches dues, puis envoi de la file). Vercel Cron envoie cet en-tête automatiquement quand `CRON_SECRET` est défini ; ailleurs, un planificateur externe ou `pg_cron` + `pg_net` peut appeler l'adresse. Sans `CRON_SECRET`, l'adresse refuse de s'exécuter (503).
- E-mails : `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (domaine vérifié chez Resend, SPF et DKIM). Sans fournisseur en production, les envois sont marqués « ignorés ».

## Avant chaque mise en production

1. `npm run check` vert.
2. Nouvelles migrations appliquées d'abord en préproduction.
3. Sauvegarde de la base vérifiée.
4. `SMOKE_BASE_URL=https://… npm run smoke` sur l'environnement déployé.
