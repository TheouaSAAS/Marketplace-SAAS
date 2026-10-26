# Tests et assurance qualité

Rapport du **niveau 27** (24/10/2026). Toutes les suites se rejouent avec `npm run check` (typage, lint, tests unitaires, build, smoke, bout en bout) et `npm run db:verify` (base réelle, transactions annulées). La CI GitHub rejoue `npm run check` sans base à chaque push.

## Les suites

| Suite | Commande | Contenu | Résultat |
| --- | --- | --- | --- |
| Unitaires et intégration | `npm test` | Règles métier, filtres, statuts, droits par rôle, transformations IA (modèle simulé), composants | 546 tests, 64 fichiers |
| Couverture | `npm run test:coverage` | Règles métier (`domain`), `lib`, configuration, composants | domaine 94,6 % des lignes, `lib` 79,9 %, configuration 100 %, composants 11,5 % (exercés par les tests de bout en bout) |
| Base de données | `npm run db:verify` | RLS, fonctions, déclencheurs, modération, notifications, IA, sécurité, hygiène des données | 28 suites, 550 vérifications |
| Statique SQL | `npm test` (`supabase/migrations.test.ts`) | Syntaxe SQL et PL/pgSQL de toutes les migrations et données de démonstration | — |
| Smoke | `npm run smoke` | 44 pages (statut, contenu attendu), sitemap, absence de secret dans le code du navigateur | 44 pages |
| Bout en bout | `npm run e2e` | Edge mobile (Pixel 7) et ordinateur, 30 fichiers ; comptes de test créés et supprimés automatiquement | ~320 réussis, 67 ignorés par conception |
| Accessibilité | (inclus) `e2e/accessibility.spec.ts` | axe-core WCAG 2.2 AA : 32 pages publiques (dont 7 fiches) et 17 pages connectées, mouvement réduit, focus | bloquant (grave, critique) |
| Performance | (inclus) `e2e/performance.spec.ts` | Poids compressé, CLS, LCP sur 8 pages mobiles (dont « Toutes les annonces ») | bloquant (budget) |
| Sécurité | (inclus) `e2e/security.spec.ts`, `level26_security.sql` | En-têtes, CSP sans violation, défi anti-robot, matrice d'accès | bloquant |

« Ignorés par conception » : tests qui modifient des comptes de test partagés (exécutés sur un seul profil), tests de mesure réservés au mobile, et tests qui exigent la base (ignorés en CI sans base, où l'état dégradé est testé à leur place).

## Parcours critiques couverts

| Parcours | Mobile | Ordinateur | Tests |
| --- | --- | --- | --- |
| Inscription, connexion, mot de passe | ✅ | ✅ | `accounts.spec` (erreurs expliquées, règles du mot de passe, connexion, profil, export des données, déconnexion, liens invalides), `level3_accounts.sql` |
| Recherche (texte, filtres, langage courant, IA simulée) | ✅ | ✅ | `search.spec`, `real-estate.spec`, `services.spec`, `natural-language.test`, `ai-interpretation.test` |
| Favoris, « j'aime », commentaires | ✅ | ✅ | `listing.spec`, `level8_engagement.sql` |
| Contact, messagerie, blocage | ✅ | ✅ | `listing.spec`, `shops.spec`, `level8_contact.sql`, `level26_security.sql` |
| Publication (brouillon, assistant, photo, charte, aperçu) | — | ✅ | `publishing.spec`, `photos.test`, `publishing.test` |
| Modération, signalements, recours, fraude | — | ✅ | `publishing.spec`, `back-office.spec`, `level22_back_office.sql`, `level26_security.sql` |
| « Nouveau à San Pedro ? » | ✅ | ✅ | `newcomer.spec`, `level6_newcomer.sql`, `ai.spec` |
| Pages pro, espace pro, équipe | — | ✅ | `pros.spec`, `pro-space.spec`, `level19_pros.sql`, `level21_pro_dashboard.sql` |
| Événements, emploi, guide, quartiers, carte, tourisme, commerces | ✅ | ✅ | un fichier e2e et une suite SQL par domaine |
| Toutes les annonces : rubriques, filtres par catégorie, tri, retour depuis une fiche, temps réel (publication, disponibilité, retrait sans rechargement) | ✅ | ✅ | `listings-browse.spec`, `browse.test`, `live.test`, `level28_listing_sections.sql` |
| Rubriques administrables (création, quatre niveaux, suppression avec reprise) | — | ✅ | `admin.spec`, `categories.test` (admin), `level28_listing_sections.sql` |
| Connexion, inscription (deux profils), adresse non confirmée, lien expiré, administration (connexion dédiée, refus, second facteur TOTP) | ✅ | ✅ | `auth-access.spec`, `accounts.spec`, `schemas.test`, `roles.test`, `auth_access.sql` ; le compte administrateur de test passe par un vrai second facteur dans tous les parcours |
| Notifications, préférences, désabonnement | ✅ | ✅ | `notifications.spec`, `dashboard.spec`, `level24_notifications.sql`, `email.test` |

Les parcours qui modifient des comptes partagés tournent sur le profil ordinateur ; leur rendu mobile est couvert par les tests de pages, l'audit d'accessibilité et le test de débordement à 360 px.

## Rôles, modération et vérification

- Droits par rôle (membre, professionnel, éditeur local, modérateur, administrateur, superadministrateur) : suites SQL de chaque niveau, `back-office.test` (outils affichés), matrice d'accès `level26_security.sql`.
- Cycle de publication et transitions de statut : `content-status.test`, `security.sql`, `level18_publishing.sql`.
- Statuts de vérification : contenu non vérifié jamais présenté comme certain (`guide.spec`, `level2.sql`), exemples jamais indexés (`seo.spec`), jamais dans la base de connaissances de l'assistant (`level23_ai_layer.sql`).

## Avec et sans IA

L'IA est désactivée sur cette instance : la CI et les tests de bout en bout vérifient le site **sans IA**. Le comportement **avec IA** est testé par un modèle simulé (aucun appel réseau) :

| Cas | Attendu | Test |
| --- | --- | --- |
| Aucune source vérifiée | « Je ne dispose pas d'information vérifiée », sans appel au modèle | `assistant.test`, `ai.spec` |
| Contenu non vérifié | jamais renvoyé comme passage | `level23_ai_layer.sql` |
| Demande ambiguë, réponse non citée | jamais affichée | `assistant.test`, `rag.test` |
| Citation vers un document inexistant | ignorée | `rag.test` |
| Consigne cachée dans un contenu, une question, une annonce | neutralisée avant envoi | `rag.test`, `assistant.test`, `ai-interpretation.test`, `moderation-ai.test` |
| Catégorie ou quartier inventés par le modèle | écartés | `ai-interpretation.test` |
| IA coupée, budget ou quota atteint | site utilisable, passages vérifiés présentés | `assistant.test`, `ai-interpretation.test`, `level23_ai_layer.sql` |
| Aide à la modération | suggestion seulement, aucune écriture | `moderation-ai.test` |

## Données de test et de démonstration

- Tests SQL : transactions annulées, préfixes `Zq…`, comptes `…@test.invalid`.
- Tests de bout en bout : comptes `e2e-<hex>@test.invalid` créés par l'API d'administration, supprimés en fin d'exécution avec leurs demandes et **organisations** ; orphelins supprimés au démarrage suivant ; contenus préfixés `Zqe2e`.
- Démonstration (`supabase/seeds/demo.sql`, retirable par `demo_remove.sql`) : statut `placeholder`, titres « Exemple — … (à valider localement) », jamais indexés ni utilisés par l'assistant.
- `supabase/tests/zz_hygiene.sql` vérifie qu'aucun reste de test de plus d'un jour ne subsiste et que chaque exemple est bien marqué.

## Défauts corrigés à ce niveau

- Comptes de test impossibles à supprimer quand ils avaient créé une organisation (la base protège le créateur et le dernier propriétaire) : deux comptes orphelins de la veille s'accumulaient. Le nettoyage supprime désormais leurs organisations ; orphelins nettoyés.
- Formulations d'arnaque non bloquées à la soumission : « envoyez un acompte », « acompte avant la visite ». L'acompte à la signature reste permis.

## Revues manuelles ciblées (avant le lancement)

- Lecteurs d'écran : TalkBack (Android), NVDA (Windows), VoiceOver (iOS) sur l'accueil, la recherche, une fiche annonce, la publication et la messagerie.
- Zoom à 200 et 400 %, contraste élevé de Windows, navigation au clavier de la carte.
- Appareil Android d'entrée de gamme sur réseau 3G (temps de chargement réel).
- Inscription réelle de bout en bout avec un e-mail réel : non automatisée (Supabase limite les envois d'e-mails ; un test enverrait de vrais messages).
- Lecture juridique de la charte, de l'accord de transaction et des pages légales.

## Risques restants

| Risque | Niveau | Atténuation |
| --- | --- | --- |
| Réponses rédigées par l'IA jamais exercées contre le vrai modèle (IA désactivée) | moyen | modèle simulé ; garde-fous dans le code ; à essayer en préproduction avec un budget plafonné |
| Envoi d'e-mails réel non exercé (aucun fournisseur) | moyen | rendu et file testés ; à valider en préproduction avec Resend |
| Inscription par e-mail non automatisée | faible | comptes de test par l'API ; revue manuelle avant lancement |
| Tests de bout en bout sensibles à la charge du poste (délais réseau vers la base distante) | faible | nouvel essai automatique ; tests longs isolés par profil |
| Composants peu couverts par les tests unitaires | faible | couverts par les tests de bout en bout et l'audit d'accessibilité |
| Paiement non implémenté | — | désactivé (drapeau `payments`), aucune promesse de paiement |
