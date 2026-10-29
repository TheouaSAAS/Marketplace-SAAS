# Checklist de lancement

✅ : prêt dans le code et vérifié par les tests. ☐ : action humaine ou configuration d’un fournisseur. Détails : `docs/deployment.md` (déploiement), `docs/runbook.md` (exploitation, incidents).

## Qualité

- ✅ `npm run check` vert : typage, lint, tests unitaires, build, smoke, tests de bout en bout mobile et ordinateur, audit WCAG 2.2 AA, budget de performance, en-têtes de sécurité.
- ✅ `npm run db:verify` vert (à rejouer en préproduction après chaque migration, workflow « Déploiement »).
- ✅ Aucune donnée de test restante (`zz_hygiene.sql`) ; exemples de démonstration marqués « Exemple — … ».
- ☐ Revues manuelles : lecteurs d’écran, zoom 200/400 %, appareil d’entrée de gamme en 3G (voir `docs/testing.md`).
- ☐ Inscription réelle avec un e-mail réel (confirmation, connexion, suppression du compte), en préproduction.

## Infrastructure (bloquant)

- ☐ Projets Supabase de préproduction et de production distincts du développement.
- ☐ **Sauvegardes** : forfait avec sauvegardes quotidiennes (PITR pour la production) ; `npm run db:backups` doit lister au moins une sauvegarde (aujourd’hui : aucune) ; une restauration testée dans un projet de test.
- ☐ Hébergeur choisi, dépôt relié ; environnements GitHub `preproduction` et `production` (variables, secrets, approbation) ; branche `main` protégée par « Qualité ».
- ☐ Domaine, DNS, HTTPS, redirection `www` ; URL du site dans Supabase Authentication.
- ✅ `npm run env:check -- preview|production` : contrôle sans afficher de valeur ; ☐ à passer sans erreur sur chaque environnement.
- ✅ Préproduction non indexable, bandeau visible, code d’accès (`SITE_ACCESS_CODE`).

## Données

- ☐ Retirer ou remplacer les exemples de démonstration (`supabase/seeds/demo_remove.sql`) par des données validées localement.
- ☐ Vérifier les premières données locales (source, date, responsable) pour nourrir l’assistant et les badges « Vérifié ».
- ☐ Quartiers et périmètres validés par l’équipe locale ; rubriques et sous-catégories relues dans `/admin/categories`.

## Comptes et e-mails (bloquant pour l'inscription publique)

- ☐ **SMTP personnalisé** pour Supabase Auth : renseigner `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (domaine vérifié chez le fournisseur : SPF, DKIM) — ou `AUTH_SMTP_*` pour un autre fournisseur — puis `npm run db:auth-config` (`--dry-run` pour prévisualiser) : SMTP, modèles français (confirmation, mot de passe, changement d'adresse, alertes de second facteur), adresse du site et redirections. Sans lui, Supabase n'envoie que 2 e-mails par heure aux seules adresses de l'équipe du projet ; l'inscription publique est alors refusée avec un message explicite.
- ✅ Confirmation de l'adresse obligatoire, liens à usage unique valables une heure, renvoi limité.
- ✅ Second facteur TOTP exigé pour le back-office (activé chez Supabase et par la base). ☐ Chaque membre de l'équipe le configure à sa première connexion ; ☐ au moins deux superadministrateurs (réinitialisation d'un facteur perdu).
- ✅ Premier superadministrateur créé le 29/10/2026 (inscription confirmée, `npm run db:promote`, journalisé) et second facteur actif. ☐ Créer un second superadministrateur (réinitialisation d'un facteur perdu).
- ☐ Envisager le CAPTCHA de Supabase Auth (Turnstile ou hCaptcha) si les inscriptions automatisées apparaissent : non configuré (défi anti-robot maison actif).

## Cabine en ligne

- ✅ Démonstration clairement signalée, aucune opération réelle possible sans prestataire intégré.
- ☐ Prestataire agréé (BCEAO) sous contrat, avis juridique sur le statut de la plateforme, accords de distribution (opérateurs, CIE), intégration et essais en préproduction (`docs/cabine.md`).
- ☐ Catalogue d'offres Internet réel et tarifs vérifiés ; frais du fournisseur connus et affichés ; mentions légales et conditions de la cabine relues.

## Sécurité et conformité

- ☐ Relecture juridique : mentions légales, conditions, confidentialité, charte de confiance, accord de transaction.
- ☐ Test d’intrusion externe ; revue des politiques de stockage Supabase en production.
- ☐ **Révoquer le jeton d’accès Supabase utilisé pendant le développement (`SUPABASE_ACCESS_TOKEN` de `.env.local`)** et renouveler les clés partagées ; jetons de CI propres à chaque environnement.
- ✅ Procédure de réponse à incident (`docs/security.md`) et checklist incident (`docs/runbook.md`).

## Observabilité

- ✅ Journaux structurés, erreurs serveur journalisées et envoyées au canal d’alerte (`ALERT_WEBHOOK_URL`), sondes `/api/health` et `/api/health/ready`, indicateurs et alertes dans `/interne/statut`.
- ☐ Supervision externe sur `/api/health/ready` ; canal d’alerte de l’équipe configuré ; personne d’astreinte pendant la bêta.

## Services externes (facultatifs : le site fonctionne sans)

- ☐ E-mails : `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (domaine vérifié, SPF, DKIM, DMARC) ; essai en préproduction ; `npm run db:auth-config` (modèles français).
- ☐ Tâche planifiée : `CRON_SECRET` et appel de `/api/interne/notifications` toutes les 10 minutes.
- ☐ IA : `AI_PROVIDER=anthropic`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_EUR` ; essai encadré en préproduction ; interrupteur général dans `/admin/ia`.
- ☐ Carte : fournisseur de tuiles dédié avant un trafic important.
- ✅ Paiement : non implémenté, drapeau `payments` désactivé, refusé par `env:check`.

## Lancement progressif

- ☐ Préproduction validée (parcours complets, e-mails réels).
- ☐ Bêta privée avec `SITE_ACCESS_CODE` (20 à 50 testeurs locaux), retours collectés, suivi quotidien.
- ☐ Validation locale des données, puis ouverture : retrait du code d’accès, indexation vérifiée (Search Console).

## Réglages à vérifier en production

- ✅ `RATE_LIMIT_SCALE` et `BOT_TRAP_MIN_MS` refusés par `env:check` et signalés par `/interne/statut`.
- ☐ `NEXT_PUBLIC_SITE_URL` en HTTPS (active HSTS), `INTERNAL_STATUS_TOKEN` défini, `APP_ENV` absent ou `production`.
- ☐ Core Web Vitals de terrain suivis après l’ouverture (`docs/performance.md`).
