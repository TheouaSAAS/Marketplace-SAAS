# État de construction — Carrefour des Possibles

> Cahier détaillé de chaque niveau : `docs/plan-28-niveaux.md`.
> À lire au début de chaque session, puis vérifier l'état réel du code (`git log`, `npm run check`, `npm run db:verify`).
> Dernière mise à jour : **2026-10-22** — niveau 11 terminé.

## Niveaux

| # | Niveau | État |
| --- | --- | --- |
| 0 | Architecture, stack et fondations | ✅ terminé |
| 1 | Design system et identité visuelle | ✅ terminé (voir docs/design-system.md) |
| 2 | Base de données, gouvernance et rôles | ✅ terminé (voir docs/database.md) |
| 3 | Authentification et comptes | ✅ terminé |
| 4 | Shell et navigation | ✅ terminé — 4 entrées, barre basse mobile, assistant (honnête sans IA), fil d'Ariane, 15 rubriques en préparation, aide, vérification, signalement, contact, maintenance (503), hors ligne (service worker) |
| 5 | Accueil dynamique | ✅ terminé — accroche, recherche, 8 accès rapides, 4 sections lues en base avec règles affichées, badges de vérification, avertissement de démonstration, états vides et d'erreur |
| 6 | Parcours « Nouveau à San Pedro ? » | ✅ terminé — introduction, questionnaire en 5 étapes (brouillon repris), plan déterministe expliqué bloc par bloc avec contenus réels, enregistrement facultatif dans le compte, suppression depuis le plan ou le profil |
| 7 | Moteur de recherche | ✅ terminé — recherche transversale (annonces, lieux, professionnels, événements, guide), aperçu par type puis onglets paginés, filtres facettés et tri expliqué dans l'adresse, fautes de frappe tolérées, langage courant par règles fixes, « autour de moi » sur autorisation, recherches enregistrées, statistiques anonymes |
| 8 | Détail d'annonce, favoris et contact | ✅ terminé — fiche (vérification, prix, caractéristiques, localisation selon le choix de l'annonceur avec carte, annonceur), favoris, « j'aime », partage, commentaires sans coordonnées, signalement, contact par messagerie, coordonnées seulement si partagées, annonces similaires expliquées, états expirée / en attente, données structurées ; messagerie /messages. Non livrés : galerie photo (avec la publication), compteur de vues, temps réel instantané (rafraîchissement toutes les 20 s) |
| 9 | Immobilier | ✅ terminé — accueil et quatre entrées (location, vente, séjour temporaire, locaux professionnels), phrase en langage courant traduite en filtres, filtres adaptés à l’entrée (type, pièces, chambres, surface, meublé, budget sans conseil financier, équipements, quartier, disponibles, confirmées), cartes avec fraîcheur et « à reconfirmer », comparaison de 3 biens, conseils (règles de prudence + articles « Se loger » du guide), fiche immobilière avec alerte de fraîcheur |
| 10 | Services de proximité | ✅ terminé — métiers et mots-clés administrables, besoin en langage courant rapproché d’un métier (« ma climatisation ne fonctionne plus »), recherche de professionnels (métier, quartier, distance, disponibilité déclarée et datée, vérification, mode de contact) avec ordre expliqué, annonces de service du métier, fiche professionnelle (prestations, zone, horaires seulement si vérifiés), demande de devis avec accord explicite, suivi des demandes envoyées et reçues (/devis), gestion des catégories et métiers par les administrateurs (/admin/categories : nom, mots-clés, ordre, activation, sous-catégories ; historisée). Reportés : édition de la fiche (espace pro), photos (portfolio), avis |
| 11 | Commerces et annuaire local | ✅ terminé — vitrines (lieux « établissement ») : vues spécialisées administrables (restaurants, alimentation, mode et beauté, quincaillerie, téléphonie, auto-moto), filtres type, quartier, budget indicatif, ambiance, services, distance, vérifiés (adresse canonique, repliés sur mobile), ordre expliqué, bloc « Mis en avant » séparé et étiqueté ; vitrine `/lieux/[slug]` : description, galerie (photos déposées seulement), services, produits, budget, horaires vérifiés et sourcés ou « à confirmer » avec ouvert/fermé qualifié, carte, itinéraire si position exacte, contacts qualifiés, favoris, « j’aime », partage, signalement ; revendication par l’exploitant validée par l’équipe locale (`/admin/revendications`), suivie dans le profil, puis messagerie vers l’exploitant. Reportés : modification de la vitrine par l’exploitant (espace pro, 21), dépôt de photos (18), paiement des campagnes (21), centre de notifications (24) |
| 12 | Tourisme et itinéraires | ⏭️ prochain |
| 13–28 | Domaines, dashboards, admin, IA, sécurité, tests, déploiement | à faire |

## Pages et routes

| Route | Contenu | État |
| --- | --- | --- |
| `/` | Accueil dynamique (sections lues en base par ville) | live |
| `/connexion`, `/inscription` | Connexion, inscription (particulier / professionnel, consentements) | live |
| `/mot-de-passe-oublie`, `/mot-de-passe/nouveau` | Récupération d'accès | live |
| `/auth/confirmation` | Aboutissement des liens e-mail (`token_hash` ou `code`) | live |
| `/profil`, `/profil/export` | Profil, type de compte, sécurité, communications, export JSON, suppression | live (protégé) |
| `/conditions-utilisation`, `/confidentialite`, `/mentions-legales` | Pages légales **provisoires** (à valider par un juriste ; mentions « à compléter ») | live |
| `/aide`, `/verification`, `/signaler`, `/contact` | Aide (FAQ), méthode de vérification, signalement, contact | live |
| 13 rubriques : `/annonces`, `/emploi`, `/publier`, `/professionnels`, `/offres`, `/decouvrir`, `/tourisme`, `/guide`, `/quartiers`, `/carte`, `/evenements` | Écrans d'attente explicites, catégories réelles, `noindex` | preview |
| `/nouveau-arrivant` | Introduction du parcours, rappel du plan enregistré | live |
| `/nouveau-arrivant/questions`, `/nouveau-arrivant/plan` | Questionnaire et plan personnalisé (réponses dans l'adresse, `noindex`) | live (privées) |
| `/recherche` | Recherche transversale (filtres dans l'adresse, `noindex`) | live (privée) |
| `/immobilier`, `/immobilier/[mode]` (location, vente, temporaire, professionnel) | Immobilier : entrées, recherche et filtres dans l’adresse | live |
| `/immobilier/comparer`, `/immobilier/conseils` | Comparaison (privée, non indexée) et conseils pour se loger | live |
| `/annonces/[slug]` | Fiche d’une annonce (publique, auteur, expirée) | live |
| `/services` | Services de proximité : besoin en langage courant, métiers, filtres dans l’adresse, ordre expliqué, annonces de service | live |
| `/professionnels/[slug]` | Fiche d’un professionnel, demande de devis avec accord, signalement | live |
| `/devis` | Demandes de devis envoyées (statut) et reçues (coordonnées transmises avec accord, statut modifiable) | live (privée) |
| `/commerces` | Annuaire des commerces : vues, recherche (nom, produits), filtres dans l’adresse, sponsorisés à part, pagination | live |
| `/lieux/[slug]` | Vitrine d’un lieu : horaires qualifiés, carte, itinéraire, contact, favoris, « j’aime », partage, signalement, revendication | live |
| `/admin/revendications` | Revendications de vitrines en attente (équipe locale : éditeurs locaux et administrateurs) | live (privée) |
| `/admin/categories` | Référentiel des catégories et métiers (administrateurs seulement ; membres : « accès réservé ») | live (privée) |
| `/favoris` | Annonces mises en favori (protégé) | live (privée) |
| `/messages`, `/messages/[id]` | Messagerie : conversations et fil (protégé, participants uniquement) | live (privées) |
| `/maintenance`, `/hors-ligne` | Pages techniques | live (privées) |
| `/design-system` | Référence des composants (non indexée) | live |
| `/interne/statut` | Statut interne (jeton ; 404 sinon) | live |
| `/api/health` | Sonde de disponibilité | live |
| autres routes de `src/config/routes.ts` | — | planned (« Bientôt ») |

## Socle disponible

- **Configuration** : variables validées (`src/lib/env.ts`, `env.server.ts`) ; 16 drapeaux « demandé ET disponible » (`src/config/feature-flags.ts`).
- **Conventions** : `ActionResult`/`AppError`, `FormState` (`src/lib/form-state.ts`), `apiData`/`apiError`, `logger` JSON masqué, `proxy.ts` (pages internes, espaces protégés, rafraîchissement de session).
- **Design system** : 30 composants documentés (`docs/design-system.md`).
- **Comptes** (`src/modules/accounts`) : schémas Zod, actions serveur, formulaires ; `src/server/auth.ts` (identité vérifiée), `src/server/rate-limit.ts` (anti-abus en base).
- **Recherche** (`src/modules/search`) : paramètres et adresse canonique, interprétation du langage courant, périodes, position, fonctions SQL `search_*`, chargeurs de cartes par identifiants, recherches enregistrées, statistiques anonymes.
- **Parcours nouvel arrivant** (`src/modules/newcomer`) : modèle de réponses et passage par l'adresse, règles du plan (17 blocs, 8 au plus), questionnaire client, actions d'enregistrement et de suppression.
- **Commerces** (`src/modules/shops`) : attributs (services, ambiance, budget), horaires (lecture, statut vérifié / à confirmer, ouverture), filtres et adresse canonique, recherche, vitrine, revendications.
- **Pagination commune** (`src/components/ui/page-nav.tsx`) et liens par catégorie selon la page (`categoryHref`).
- **Services** (`src/modules/services`) : besoin → métier par mots-clés, filtres et adresse canonique, recherche de professionnels, fiche, demande de devis (accord obligatoire) et suivi des statuts.
- **Données** : Supabase `towkxqwdvjdajlohevxt` (PostgreSQL 17, eu-west-1), 21 migrations, 48 tables avec RLS, tâches `pg_cron` (expiration des annonces, purges anti-abus, statistiques, vues, coordonnées consultées), types générés, démonstration étiquetée (16 éléments, dont 3 fiches professionnelles et 4 vitrines de commerce).

## Tests (dernière exécution : 2026-10-22)

| Suite | Résultat |
| --- | --- |
| `npm run typecheck` (strict + `noUncheckedIndexedAccess`) | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 305 tests (domaine, commerces : horaires, ouverture, attributs, adresse canonique, référentiel : mots-clés, adresses, arbre, services : besoin → métier, filtres, détails et statuts des devis, immobilier : filtres, langage courant, fraîcheur, règles du plan nouvel arrivant, recherche : adresse, langage courant, périodes, fiche annonce : attributs, similaires, données structurées, catégories, configuration, composants, proxy, délai réseau, SQL statique, alignement des types) |
| `npm run db:verify` (base réelle, transactions annulées) | ✅ 195/195 |
| `npm run build` | ✅ |
| `npm run smoke` | ✅ 43 pages + scan du bundle navigateur ; adapté à l’absence de base (CI) |
| `npm run e2e` (Edge, mobile + ordinateur, 2 navigateurs à la fois, 3 comptes de test — dont un administrateur — créés/supprimés automatiquement) | ✅ 148 réussis, 24 ignorés par conception ; sans base (CI simulée en local, 2026-10-22) : 82 réussis, 90 ignorés |
| CI GitHub Actions | écrite, **jamais exécutée** (dépôt non poussé) |

## Problèmes connus et blocages

- **E-mails (bloquant pour l'ouverture au public)** : aucun SMTP personnalisé. Supabase n'envoie alors que 2 e-mails par heure, aux seuls membres de l'équipe du projet, en anglais. Il faut un fournisseur d'e-mails (Resend, Brevo, SMTP…) avec domaine vérifié, puis `npm run db:auth-config` appliquera les modèles français.
- `SUPABASE_ACCESS_TOKEN` (accès à tout le compte Supabase) présent dans `.env.local` pour les migrations : **à révoquer** en fin de chantier.
- Accès PostgreSQL direct bloqué depuis le poste (bannissement réseau Supabase) : migrations via l'API d'administration.
- `npm run db:verify` hors CI (pas d'identifiants en CI).
- `npm audit` : 5 alertes dans l'outillage ESLint (développement uniquement) ; 0 en production.
- Pages légales : textes provisoires, informations d'éditeur à compléter, validation juridique requise.
- Suivi d'erreurs externe non branché.
- Section 4.7 (indicateurs) du premier cahier des charges non fournie.

## Données à valider localement

Voir `docs/data-governance.md` (centre de la ville, quartiers, démonstration).

## Prochaine étape

Niveau 12 — tourisme et itinéraires : destinations, lieux, activités, hébergements, restaurants, opérateurs ; pages « Où dormir ? », « Où manger ? », « Que découvrir ? », « Sortir » ; filtres (thème, public, durée, budget, accessibilité, distance, vérification) ; créateur d’itinéraire fondé sur les seules données présentes en base. Réutilisables : vitrine `/lieux/[slug]`, `place_point`, `place_engagement`, horaires qualifiés, `search_shops` comme modèle.
