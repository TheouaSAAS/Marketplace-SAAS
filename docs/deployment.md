# Déploiement

État : **non déployé**. Le code est prêt pour une préproduction puis une production ; chaque section distingue ce qui est **prêt dans le code** (✅) de ce qui demande **une action humaine ou un fournisseur** (☐). Exploitation au quotidien et incidents : `docs/runbook.md`.

## Environnements

| Environnement | `APP_ENV` | Base Supabase | Adresse | Indexation | Accès |
| --- | --- | --- | --- | --- | --- |
| Développement | `development` (défaut hors build) | projet de développement (actuel : `towkxqwdvjdajlohevxt`) | `http://localhost:3000` | jamais | libre |
| Préproduction | `preview` | **projet distinct**, données de test | sous-domaine HTTPS (ex. `preprod.<domaine>`) | jamais (`robots.txt` fermé, `X-Robots-Tag: noindex`) | code d’accès (`SITE_ACCESS_CODE`) |
| Production | `production` (défaut d’un build) | projet de production | domaine HTTPS | oui | ouvert (ou code pendant la bêta privée) |

- ✅ L’environnement est déduit de `APP_ENV`, sinon de l’hébergeur (`VERCEL_ENV`), sinon du build (`src/config/environment.ts`). Une préproduction auto-hébergée **doit** déclarer `APP_ENV=preview`.
- ✅ Préproduction : bandeau « Préproduction : site de test » sur toutes les pages, aucune indexation.
- ✅ Accès réservé : avec `SITE_ACCESS_CODE`, toute page sert `/acces` (401, non indexée) tant que le code n’a pas été saisi ; la supervision (`/api/health`, `/api/interne`, `/interne`) reste joignable. Le cookie contient une empreinte du code : changer le code révoque tous les accès.
- ☐ Créer le projet Supabase de préproduction, puis celui de production (région proche des utilisateurs, forfait avec sauvegardes).
- Ne jamais pointer un environnement de développement ou de préproduction sur la base de production.

## Hébergement

Next.js 16 (Cache Components) : Vercel (le plus simple) ou Node.js auto-hébergé (`npm ci && npm run build && npm start`, derrière un proxy HTTPS).

- ✅ Aucun état local : sessions et limites anti-abus en base, fichiers dans Supabase Storage. Plusieurs instances possibles.
- ✅ Cache serveur invalidé par étiquettes (`updateTag`) : sur Vercel, partagé entre instances ; en auto-hébergement multi-instances, prévoir un gestionnaire de cache partagé ou une seule instance (les listes d’annonces sont lues sans cache, voir D130).
- ☐ Choisir l’hébergeur, relier le dépôt GitHub (déploiement de `main` en production, des branches en préproduction).

## Variables d’environnement

Modèle complet : `.env.example`. `NEXT_PUBLIC_*` sont intégrées au build : les définir **avant** `npm run build`. Les secrets ne vont que dans le gestionnaire de secrets de l’hébergeur, jamais dans le dépôt.

`npm run env:check -- production` (ou `preview`) contrôle la configuration **sans afficher aucune valeur** : erreurs bloquantes (adresse non HTTPS, clé secrète absente, réglages de test `RATE_LIMIT_SCALE` / `BOT_TRAP_MIN_MS`, préproduction non déclarée, paiement activé) et points d’attention (jeton de statut, secret des tâches planifiées, e-mails, IA sans plafond, accès d’administration de la base laissés dans l’application). À lancer sur l’hébergeur ou avec ses variables exportées.

| Variable | Dév. | Préprod. | Prod. | Remarque |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | localhost | HTTPS | HTTPS | active HSTS, liens des e-mails |
| `NEXT_PUBLIC_SUPABASE_URL`, `…_PUBLISHABLE_KEY` | ✔ | ✔ (projet préprod.) | ✔ (projet prod.) | publiques |
| `SUPABASE_SECRET_KEY` | facultatif | ✔ | ✔ | secret serveur |
| `APP_ENV` | — | `preview` | — ou `production` | |
| `SITE_ACCESS_CODE` | — | ✔ | bêta privée seulement | 12 caractères min. |
| `INTERNAL_STATUS_TOKEN` | — | ✔ | ✔ | 24 caractères min. |
| `CRON_SECRET` | — | ✔ | ✔ | 24 caractères min. |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM` | simulés | ✔ | ✔ | domaine vérifié (SPF, DKIM) |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_EUR` | — | essai encadré | facultatif | plafond obligatoire si activée |
| `ALERT_WEBHOOK_URL` | — | conseillé | ✔ | canal d’alerte de l’équipe |
| `GIT_COMMIT_SHA` | — | conseillé | conseillé | affiché par `/interne/statut` (Vercel : automatique) |
| `FEATURE_*` | — | — | selon le lancement | voir « Drapeaux » |
| `SUPABASE_ACCESS_TOKEN`, `DATABASE_URL` | poste | **CI uniquement** | **CI uniquement** | jamais dans l’application |
| `RATE_LIMIT_SCALE`, `BOT_TRAP_MIN_MS` | tests | **interdits** | **interdits** | |

## Migrations de la base

- ✅ Migrations versionnées (`supabase/migrations/AAAAMMJJHHMMSS_nom.sql`), appliquées dans l’ordre par `npm run db:migrate`, chacune dans une transaction (un échec n’applique rien) et inscrite dans `supabase_migrations.schema_migrations`. `npm run db:status` liste appliquées et en attente.
- ✅ Règles : une migration appliquée n’est **jamais modifiée** (correctif = nouvelle migration) ; migrations **compatibles avec la version précédente du code** (ajouter avant de retirer : le code déjà en ligne doit fonctionner avec la nouvelle base pendant le déploiement) ; les suppressions de colonnes ou de tables se font en deux temps (code qui ne les utilise plus, puis migration).
- ✅ Ordre : préproduction d’abord (`db:migrate` puis `db:verify`, tests en transactions annulées), production ensuite, toujours **avant** le déploiement du code.
- ✅ Workflow GitHub « Déploiement » (manuel) : étape `migrations` = contrôles qualité complets puis migrations de l’environnement choisi (+ `db:verify` en préproduction).

## Sauvegardes et restauration

- ☐ **Bloquant avant l’ouverture** : le projet actuel n’a **aucune sauvegarde** (`npm run db:backups` : liste vide, PITR inactive — forfait gratuit). Souscrire un forfait avec sauvegardes quotidiennes (Pro) et, pour la production, la restauration à un instant donné (PITR).
- ✅ `npm run db:backups` liste les sauvegardes disponibles (lecture seule) et échoue s’il n’y en a aucune : à lancer avant chaque migration de production.
- ☐ En complément (indépendant du forfait) : `pg_dump` chiffré planifié depuis un poste ou un serveur d’exploitation ayant l’accès direct à la base (`supabase db dump`), conservé hors de Supabase.
- Fichiers (Storage) : non couverts par les sauvegardes de la base ; copie périodique des seaux `media` et `private-media` à prévoir (☐).
- Restauration (procédure détaillée dans `docs/runbook.md`) : restaurer d’abord dans un **nouveau projet** ou en préproduction pour vérifier, puis basculer ; une restauration écrase tout ce qui a été écrit depuis la sauvegarde. **Test de restauration à réaliser au moins une fois avant l’ouverture** (☐).

## Retour arrière (rollback)

- **Code** : redéployer la version précédente (Vercel : « Instant Rollback » sur le déploiement précédent ; auto-hébergé : `git checkout <commit>` + build, ou image précédente). Possible à tout moment grâce aux migrations compatibles avec la version précédente.
- **Base** : pas de migration « descendante » automatique. Une migration fautive se corrige par une **migration compensatoire** (nouvelle migration qui rétablit l’état), testée en préproduction. En dernier recours seulement : restauration d’une sauvegarde (perte des écritures postérieures).
- **Fonctionnalité** : couper le drapeau concerné (`FEATURE_<CLÉ>=off`, redéploiement ou redémarrage) sans toucher au code.
- **Site entier** : `FEATURE_MAINTENANCE=on` sert `/maintenance` (503, `Retry-After`) à toutes les pages ; la supervision reste joignable.

## Intégration et déploiement continus

- ✅ Workflow « Qualité » à chaque push et demande de fusion : typage, lint, tests unitaires, build, test de fumée, tests de bout en bout (sans base : états dégradés), audit des dépendances de production.
- ✅ Workflow « Déploiement » (manuel, onglet Actions) : `migrations` (Qualité puis migrations) et `verification` (sonde `/api/health/ready` puis test de fumée sur le site déployé, code d’accès compris). Secrets par environnement GitHub.
- ☐ Créer les environnements GitHub `preproduction` et `production` (approbation obligatoire pour la production) avec : variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SITE_URL` ; secrets `SUPABASE_ACCESS_TOKEN` (jeton d’un compte de service, propre au projet), `INTERNAL_STATUS_TOKEN`, `SITE_ACCESS_CODE`.
- ☐ Protéger la branche `main` : fusion seulement si « Qualité » est vert ; côté hébergeur, ne promouvoir en production qu’un commit vérifié.

## Domaine, HTTPS et en-têtes

- ✅ En-têtes de sécurité sur toutes les réponses (`next.config.ts`) : CSP stricte (aucun script externe, connexions limitées à Supabase en HTTPS et WSS), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (géolocalisation pour notre origine seulement), COOP ; HSTS dès que `NEXT_PUBLIC_SITE_URL` est en HTTPS ; `X-Robots-Tag: noindex` hors production.
- ✅ Politiques d’accès : RLS sur toutes les tables, pages internes à jeton (404 sinon), espaces protégés, accès réservé facultatif.
- ☐ Acheter le domaine, configurer le DNS chez l’hébergeur (enregistrements A/CNAME), certificat HTTPS automatique, redirection `www` ↔ domaine nu, puis `NEXT_PUBLIC_SITE_URL` et l’URL du site dans Supabase (Authentication > URL Configuration : Site URL et adresses de redirection).
- ☐ E-mails : enregistrements SPF, DKIM et DMARC du domaine d’envoi.

## Observabilité

- ✅ Journaux structurés JSON (`src/lib/logger.ts`), secrets et données personnelles masqués ; niveau `LOG_LEVEL`.
- ✅ Erreurs serveur : `src/instrumentation.ts` journalise chaque erreur de rendu, d’action ou de route (chemin sans paramètres, empreinte `digest`) et l’envoie au canal `ALERT_WEBHOOK_URL` (Slack, Discord, Google Chat), une alerte par erreur et par 10 minutes.
- ✅ Sondes : `/api/health` (le processus répond) pour l’hébergeur ; `/api/health/ready` (200 si la base répond, 503 sinon) pour la supervision externe.
- ✅ `/interne/statut?token=…` : environnement, commit, services, drapeaux, variables (présence), **indicateurs d’exploitation** (volume de la base et du stockage, IA du mois, annonces par statut, file de modération et son ancienneté, signalements et recours ouverts, notifications en attente ou en échec, tâches planifiées en échec, temps réel) avec alertes.
- ✅ Performance : budget bloquant dans les tests (`docs/performance.md`).
- ☐ Brancher une supervision externe sur `/api/health/ready` (toutes les 5 minutes, alerte après 2 échecs) et un collecteur de journaux (celui de l’hébergeur suffit au départ).
- ☐ Suivi d’erreurs dédié (Sentry ou équivalent) : `ERROR_TRACKING_DSN` est réservé, non branché (le webhook d’alerte couvre le besoin initial).
- ☐ Core Web Vitals de terrain (Vercel Speed Insights ou équivalent) après l’ouverture.

## Suivi des coûts

| Poste | Où le suivre | Garde-fou dans le code | Action |
| --- | --- | --- | --- |
| Base Supabase (taille, calcul) | `/interne/statut`, tableau de bord Supabase | alerte à 80 % du forfait ; purges planifiées (statistiques, vues, limites) | ☐ choisir le forfait, alertes de facturation Supabase |
| Stockage des photos | `/interne/statut` (par seau) | 10 photos de 5 Mo au plus par annonce | ☐ politique de rétention des annonces archivées |
| Bande passante, temps réel | tableau de bord Supabase | un seul canal public, messages réduits à un identifiant, client chargé après l’affichage | ☐ surveiller connexions simultanées et messages |
| Carte (tuiles) | — | tuiles configurables (`NEXT_PUBLIC_MAP_TILE_URL`), carte chargée à la demande | ☐ fournisseur de tuiles dédié avant un trafic important (politique d’usage OpenStreetMap) |
| IA | `/admin/ia`, `/interne/statut` | coupure générale, quotas par personne, plafond mensuel `AI_MONTHLY_BUDGET_EUR`, IA désactivée sans clé | ☐ plafond et alertes chez le fournisseur |
| E-mails | tableau de bord du fournisseur | préférences par canal, file d’envoi avec reprises | ☐ forfait adapté au volume |
| Hébergement | tableau de bord de l’hébergeur | pages pré-rendues, cache | ☐ alertes de facturation |

## Drapeaux de fonctionnalités

✅ `src/config/feature-flags.ts`, état réel dans `/interne/statut`. Une fonctionnalité n’est active que si elle est demandée **et** que son service est configuré ; forçage par `FEATURE_<CLÉ>=on|off`. Couper une fonctionnalité laisse le site utilisable :

| Drapeau | Sans lui |
| --- | --- |
| `ai_search`, `ai_assistant`, `ai_publishing`, `ai_moderation` | recherche et assistant par règles fixes, publication sans suggestions d’IA |
| `payments` | désactivé (non implémenté) : rien n’est payant ni simulé |
| `geolocation` | pas de « Autour de moi » ; recherche par quartier |
| `publishing` | dépôt d’annonces et d’offres fermé (message explicite, brouillons conservés) ; consultation intacte |
| `pro_publishing` | ni création ni soumission de page professionnelle, ni équipe, ni annonce au nom d’une page ; pages existantes visibles |
| `messaging` | aucun nouveau message (annonces, lieux, événements, conversations) ; coordonnées affichées par les annonceurs toujours accessibles |
| `email_notifications` | notifications dans le site uniquement |
| `push_notifications`, `sms` | non implémentés : toujours inactifs (aucun fournisseur) |
| `live_updates` | listes rechargées chaque minute au lieu du temps réel |
| `map` | listes sans carte |
| `maintenance` | (activé) tout le site répond 503 |

## Tâches planifiées

- ✅ En base (pg_cron) : expiration des annonces, rappels d’événements, relances d’annonces qui expirent, purges (voir `docs/database.md`). Échecs visibles dans `/interne/statut`.
- ☐ Sur l’hébergeur : `GET` ou `POST /api/interne/notifications` toutes les 10 minutes avec `Authorization: Bearer <CRON_SECRET>` (alertes de recherches dues, puis envoi de la file). Vercel Cron envoie l’en-tête quand `CRON_SECRET` est défini (fréquence de 10 minutes : forfait Pro ; le forfait gratuit limite à une exécution par jour) ; sinon planificateur externe, ou `pg_cron` + `pg_net` appelant l’adresse. Sans `CRON_SECRET`, l’adresse refuse de s’exécuter (503).

## Plan de lancement progressif

1. **Préproduction** (☐ projet Supabase, hébergement, domaine de test) : `env:check -- preview`, migrations et `db:verify` par le workflow, déploiement, `verification`. Essais de l’équipe : inscription réelle, e-mails réels, publication et modération, IA avec plafond bas.
2. **Bêta privée** sur le domaine de production avec `SITE_ACCESS_CODE` : 20 à 50 testeurs locaux (annonceurs, commerçants, nouveaux arrivants) ; drapeaux prudents (`ai_*` éventuellement coupés, `payments` off) ; collecte des retours (formulaire de contact, signalements, entretiens) ; suivi quotidien de `/interne/statut`.
3. **Validation locale des données** : remplacer les exemples de démonstration (`supabase/seeds/demo_remove.sql`) par des données vérifiées (source, date, responsable), valider quartiers et périmètres, relire les fiches pratiques.
4. **Ouverture** : retirer `SITE_ACCESS_CODE`, vérifier l’indexation (`robots.txt`, sitemap, Search Console), communiquer ; renforcer la modération les premières semaines.
5. **Après l’ouverture** : Core Web Vitals de terrain, coûts hebdomadaires, revue des alertes, villes suivantes par l’administration.

## Avant chaque mise en production

1. « Qualité » vert sur le commit visé.
2. `npm run env:check -- production` sans erreur (variables de l’hébergeur).
3. `npm run db:backups` : sauvegarde récente disponible.
4. Workflow « Déploiement » `migrations` en préproduction, vérifications, puis en production.
5. Déploiement du code par l’hébergeur.
6. Workflow « Déploiement » `verification` ; contrôle de `/interne/statut` (aucune alerte nouvelle).
