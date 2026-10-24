# Checklist de lancement

À compléter au niveau 28 (déploiement). ✅ : prêt dans le code et vérifié par les tests. ☐ : action humaine ou configuration d'un fournisseur.

## Qualité

- ✅ `npm run check` vert : typage, lint, 499 tests unitaires, build, smoke, tests de bout en bout mobile et ordinateur, audit WCAG 2.2 AA, budget de performance, en-têtes de sécurité.
- ✅ `npm run db:verify` vert sur la base de préproduction (à rejouer après chaque migration).
- ✅ Aucune donnée de test restante (`zz_hygiene.sql`) ; exemples de démonstration marqués « Exemple — … ».
- ☐ Revues manuelles : lecteurs d'écran, zoom 200/400 %, appareil d'entrée de gamme en 3G (voir `docs/testing.md`).
- ☐ Inscription réelle avec un e-mail réel (confirmation, connexion, suppression du compte).

## Données

- ☐ Retirer ou remplacer les exemples de démonstration (`supabase/seeds/demo_remove.sql`) par des données validées localement.
- ☐ Vérifier les premières données locales (source, date, responsable) pour nourrir l'assistant et les badges « Vérifié ».
- ☐ Quartiers et périmètres validés par l'équipe locale.

## Sécurité et conformité

- ☐ Relecture juridique : mentions légales, conditions, confidentialité, charte de confiance, accord de transaction.
- ☐ Test d'intrusion externe ; revue des politiques de stockage Supabase en production.
- ☐ Révoquer le jeton d'accès Supabase utilisé pendant le développement (`SUPABASE_ACCESS_TOKEN`) et renouveler les clés partagées.
- ✅ Procédure de réponse à incident (`docs/security.md`).

## Services externes (facultatifs : le site fonctionne sans)

- ☐ E-mails : `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` (domaine vérifié, SPF, DKIM) ; essai en préproduction.
- ☐ Tâche planifiée : `CRON_SECRET` et appel de `/api/interne/notifications` toutes les 10 minutes.
- ☐ IA : `AI_PROVIDER=anthropic`, `AI_API_KEY`, `AI_MONTHLY_BUDGET_EUR` ; essai encadré en préproduction ; interrupteur général dans `/admin/ia`.
- ☐ Paiement : non implémenté, drapeau `payments` désactivé.

## Réglages à vérifier en production

- ☐ `RATE_LIMIT_SCALE` et `BOT_TRAP_MIN_MS` absents (réglages de test signalés par `/interne/statut`).
- ☐ `NEXT_PUBLIC_SITE_URL` en HTTPS (active HSTS), `INTERNAL_STATUS_TOKEN` défini.
- ☐ Core Web Vitals de terrain suivis après l'ouverture (`docs/performance.md`).
