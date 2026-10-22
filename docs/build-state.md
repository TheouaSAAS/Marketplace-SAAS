# État de construction — Carrefour des Possibles

> Cahier détaillé de chaque niveau : `docs/plan-28-niveaux.md`.
> À lire au début de chaque session, puis vérifier l'état réel du code (`git log`, `npm run check`, `npm run db:verify`).
> Dernière mise à jour : **2026-10-22** — niveau 16 terminé.

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
| 12 | Tourisme et itinéraires | ✅ terminé — `/decouvrir` (quatre entrées, lieux enregistrés, événements, itinéraire), « Où dormir ? », « Où manger ? », « Que découvrir ? », « Sortir » (`/decouvrir/[entree]`, événements à venir), exploration `/tourisme` ; filtres thème, public, durée, budget, accessibilité, distance (environs), vérifiés, repliés sur mobile ; catégorie des opérateurs (excursions, guides) ; vitrine enrichie (infos pratiques, avertissements, source, statut et date de vérification, « information à confirmer localement ») ; créateur d’itinéraire déterministe `/tourisme/itineraire` (lieux enregistrés seulement, moments sans lieu signalés, distances à vol d’oiseau, aucun horaire ni trajet inventé). Reportés : médias déposés (18), saisie des attributs touristiques dans l’administration (22), itinéraire assisté par IA (23) |
| 13 | Guide pratique de la ville | ✅ terminé — `/guide` (11 rubriques administrables, recherche avec le moteur du site), `/guide/[rubrique]` (articles, ressources du site avec nombre de contenus, autres rubriques), `/guide/[rubrique]/[article]` (statut annoncé : vérifié, vérification ancienne, à confirmer, exemple ; avertissement « orientation générale », sommaire, Markdown restreint sans HTML, auteur, source, vérification, version et historique public, contenus liés, suggestion de correction, signalement) ; rédaction `/admin/guide` (équipe locale : création, note de version obligatoire, sources, statut de publication et de vérification, versions consultables, traitement des suggestions) ; articles publiés découpés en passages pour l’assistant. Reportés : vecteurs et réponses de l’assistant (23), restauration d’une ancienne version en un clic, médias dans les articles (18) |
| 14 | Quartiers | ✅ terminé — `/quartiers` (liste alphabétique, statut, périmètre validé ou non, nombre de contenus rattachés, rappel de neutralité), `/quartiers/[slug]` (noms alternatifs, description neutre ou « à confirmer », avertissements fiche non vérifiée et sans périmètre, onglets à découvrir, logement, services, commerces, tourisme et carte avec les seuls contenus rattachés et liens vers les domaines filtrés, source et contrôle) ; administration `/admin/quartiers` (fiche historisée avec note, responsable, brouillons de périmètre GeoJSON contrôlés et prévisualisés, validation ou refus motivé, ancien périmètre conservé, retrait motivé, journal) ; filtre quartier ajouté au tourisme. Reportés : tracé du périmètre sur la carte (15), critères administrés de description (aucun qualificatif affiché d’ici là) |
| 15 | Carte interactive | ✅ terminé — `/carte` : fond configurable (OpenStreetMap sans clé par défaut, Leaflet chargé à la demande), couches immobilier, services, commerces, tourisme, événements et emploi (points du guide annoncés indisponibles : aucune position), marqueurs regroupés selon le zoom, carte et liste synchronisées avec fiche rapide (statut, précision, lien vers la fiche, itinéraire OpenStreetMap vers un point exact seulement), filtres couches et quartier dans l’adresse, « Rechercher dans cette zone » (une requête par demande, 300 éléments au plus), position facultative du niveau 7 ; seules les positions publiques (annonces « quartier seulement » ou « masquées » absentes, approximatives en pointillés) ; repli liste sans carte. Lien depuis l’onglet Carte des quartiers. Reportés : tracé des périmètres à main levée (administration, 22), couche emploi alimentée avec les offres (17) |
| 16 | Événements | ✅ terminé — `/evenements` : liste groupée par jour (à venir seulement, du plus proche au plus lointain), calendrier mensuel (jours passés grisés), lien vers la carte, filtres aujourd’hui, week-end, semaine, mois, gratuit ou payant, catégorie, quartier ; fiche `/evenements/[slug]` : date et heure, bandeaux « Annulé » (motif) et « Reporté » (date initiale et nouvelle), « Terminé », lieu avec carte et itinéraire, organisateur, contacts publics, billetterie, prix, source et vérification, favoris, fichier d’agenda `.ics`, partage, signalement, messagerie avec l’organisateur ; proposition `/evenements/proposer` soumise à modération (`/admin/evenements`, refus motivé, organisateur notifié) ; « Mes événements » avec report et annulation (restent publiés, motif, favoris prévenus) ; archivage 30 jours après la fin, rappel la veille pour les favoris ; nouvelles catégories formation, communauté, tourisme, autres ; dernières notifications dans le profil. Reportés : centre de notifications et rappels par e-mail (24), photos (18) |
| 17 | Emploi et opportunités | ⏭️ prochain |
| 18–28 | Domaines, dashboards, admin, IA, sécurité, tests, déploiement | à faire |

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
| 5 rubriques : `/annonces`, `/emploi`, `/publier`, `/professionnels`, `/offres` | Écrans d'attente explicites, catégories réelles, `noindex` | preview |
| `/nouveau-arrivant` | Introduction du parcours, rappel du plan enregistré | live |
| `/nouveau-arrivant/questions`, `/nouveau-arrivant/plan` | Questionnaire et plan personnalisé (réponses dans l'adresse, `noindex`) | live (privées) |
| `/recherche` | Recherche transversale (filtres dans l'adresse, `noindex`) | live (privée) |
| `/immobilier`, `/immobilier/[mode]` (location, vente, temporaire, professionnel) | Immobilier : entrées, recherche et filtres dans l’adresse | live |
| `/immobilier/comparer`, `/immobilier/conseils` | Comparaison (privée, non indexée) et conseils pour se loger | live |
| `/annonces/[slug]` | Fiche d’une annonce (publique, auteur, expirée) | live |
| `/services` | Services de proximité : besoin en langage courant, métiers, filtres dans l’adresse, ordre expliqué, annonces de service | live |
| `/professionnels/[slug]` | Fiche d’un professionnel, demande de devis avec accord, signalement | live |
| `/devis` | Demandes de devis envoyées (statut) et reçues (coordonnées transmises avec accord, statut modifiable) | live (privée) |
| `/evenements`, `/evenements/[slug]`, `/evenements/[slug]/agenda.ics` | Agenda (liste, calendrier), fiche d’un événement, fichier d’agenda | live |
| `/evenements/proposer`, `/evenements/mes-evenements`, `/admin/evenements` | Proposition, suivi et report ou annulation par l’organisateur, modération | live (privées) |
| `/carte` | Carte interactive : couches, quartier, zone, liste synchronisée, fiche rapide | live |
| `/quartiers`, `/quartiers/[slug]` | Quartiers : liste neutre, fiche à onglets (contenus rattachés, carte du périmètre validé) | live |
| `/admin/quartiers`, `/admin/quartiers/[slug]` | Fiches et périmètres des quartiers (équipe locale) | live (privées) |
| `/guide`, `/guide/[rubrique]`, `/guide/[rubrique]/[article]` | Guide pratique : rubriques, recherche, articles datés et sourcés, versions, suggestions | live |
| `/admin/guide`, `/admin/guide/[id]` | Rédaction du guide (équipe locale) : articles, versions, sources, suggestions | live (privées) |
| `/decouvrir`, `/decouvrir/[entree]` | Découvrir et sortir : quatre entrées (où dormir, où manger, que découvrir, sortir) | live |
| `/tourisme`, `/tourisme/itineraire` | Exploration touristique filtrable ; créateur d’itinéraire (demande dans l’adresse) | live |
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
- **Événements** (`src/modules/events`) : filtres et adresse canonique, calendrier (fonction pure), fichier d’agenda iCalendar, proposition, programme (report, annulation), modération.
- **Carte** (`src/modules/map`) : couches, adresse canonique (couches, quartier, zone), regroupement des marqueurs (fonction pure), carte et liste synchronisées.
- **Quartiers** (`src/modules/neighborhoods`) : onglets, avertissements, carte de périmètre (Leaflet GeoJSON), administration des fiches et périmètres.
- **Guide** (`src/modules/guide`) : Markdown restreint (arbre, sommaire, liens sûrs), statut annoncé, ressources liées, rédaction et suggestions.
- **Tourisme** (`src/modules/tourism`) : attributs (thèmes, public, durée, accessibilité), entrées, filtres et adresse canonique, itinéraire déterministe, infos pratiques et source d’une fiche.
- **Commerces** (`src/modules/shops`) : attributs (services, ambiance, budget), horaires (lecture, statut vérifié / à confirmer, ouverture), filtres et adresse canonique, recherche, vitrine, revendications.
- **Pagination commune** (`src/components/ui/page-nav.tsx`) et liens par catégorie selon la page (`categoryHref`).
- **Services** (`src/modules/services`) : besoin → métier par mots-clés, filtres et adresse canonique, recherche de professionnels, fiche, demande de devis (accord obligatoire) et suivi des statuts.
- **Données** : Supabase `towkxqwdvjdajlohevxt` (PostgreSQL 17, eu-west-1), 31 migrations, 50 tables avec RLS, tâches `pg_cron` (expiration des annonces, purges anti-abus, statistiques, vues, coordonnées consultées), types générés, démonstration étiquetée (19 éléments, dont 3 fiches professionnelles, 4 vitrines de commerce et 3 lieux touristiques ajoutés au niveau 12).

## Tests (dernière exécution : 2026-10-22)

| Suite | Résultat |
| --- | --- |
| `npm run typecheck` (strict + `noUncheckedIndexedAccess`) | ✅ |
| `npm run lint` | ✅ |
| `npm test` | ✅ 351 tests (domaine, événements : filtres, calendrier, agenda .ics, carte : adresse, zone, regroupement, itinéraire, quartiers : onglets, neutralité, guide : Markdown restreint, liens sûrs, sommaire, statut, ressources, tourisme : itinéraire déterministe, filtres, attributs, commerces : horaires, ouverture, attributs, adresse canonique, référentiel : mots-clés, adresses, arbre, services : besoin → métier, filtres, détails et statuts des devis, immobilier : filtres, langage courant, fraîcheur, règles du plan nouvel arrivant, recherche : adresse, langage courant, périodes, fiche annonce : attributs, similaires, données structurées, catégories, configuration, composants, proxy, délai réseau, SQL statique, alignement des types) |
| `npm run db:verify` (base réelle, transactions annulées) | ✅ 268/268 |
| `npm run build` | ✅ |
| `npm run smoke` | ✅ 43 pages (dont le sitemap avec `/decouvrir`, `/tourisme`, `/commerces`, `/guide`, `/quartiers`, `/carte`, `/evenements`) + scan du bundle navigateur ; adapté à l’absence de base (CI) |
| `npm run e2e` (Edge, mobile + ordinateur, 2 navigateurs à la fois, 3 comptes de test — dont un administrateur — créés/supprimés automatiquement) | ✅ 181 réussis, 38 ignorés par conception (un test des commerces cassé par le nouvel aperçu des notifications du profil, corrigé et repassé) ; sans base (CI simulée en local, 2026-10-22) : 92 réussis, 128 ignorés |
| CI GitHub Actions (`TheouaSAAS/Marketplace-SAAS`, sans base) | ✅ verte à chaque push depuis le niveau 8 ; dernier push : 2026-10-22 |

## Problèmes connus et blocages

- **Réseau du poste (22 octobre au soir)** : coupures intermittentes vers Supabase (délais de connexion de 10 s, en IPv6 comme en IPv4). Les tests navigateur les absorbent par une nouvelle tentative ; si un test échoue sur `ConnectTimeoutError`, relancer. Les comptes de test orphelins d’une exécution interrompue sont supprimés au démarrage suivant (le compte technique de démonstration avait des jetons NULL qui faisaient échouer l’API des comptes : corrigé dans `supabase/seeds/demo.sql`).

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

Niveau 17 — emploi et opportunités : voir `docs/plan-28-niveaux.md`. Réutilisables : catégories `emploi-stages`, `opportunites-commerciales`, `appels-offres` (attributs `emploi`, `opportunite`, `appel_offres`), table `job_applications` (niveau 2, candidatures privées), couche « emploi » de la carte, fiche d’annonce (niveau 8), messagerie, modération.
