# Décisions techniques

Format : contexte → décision → conséquences. Ajouter une entrée pour toute décision structurante.

## D1 — Next.js 16 avec Cache Components (2026-10-17)
Besoin de pages publiques rapides et indexables, d'interactivité et d'actions serveur dans une seule base de code. Next.js 16.4 (version stable courante) avec `cacheComponents` et `partialPrefetching` activés par défaut. Conséquence : toute lecture de cookies/session se fait derrière `<Suspense>` ; les données publiques sont mises en cache par étiquette.

## D2 — Supabase (PostgreSQL + PostGIS) (2026-10-17, validé par le porteur du projet)
Relationnel, recherche géographique native, authentification, stockage et règles RLS intégrés ; offre gratuite pour le pilote. Les droits sont garantis en base, pas seulement dans l'interface.

## D3 — Leaflet + OpenStreetMap (2026-10-17, validé par le porteur du projet)
Gratuit, sans clé, bonne couverture de la Côte d'Ivoire. L'URL des tuiles est une variable d'environnement : passer à un fournisseur de tuiles payant si le trafic dépasse la politique d'usage d'OSM. Chargement uniquement sur les pages qui affichent une carte.

## D4 — Routes à statut `live` / `planned`
Le cahier des charges impose des liens toujours fonctionnels et une construction page par page. Les menus listent toute la structure du produit, mais une page non livrée est affichée « Bientôt », non cliquable. Le passage à `live` active automatiquement menus, pied de page et sitemap.

## D5 — Lieux unifiés (`places.kind`)
Établissements et lieux touristiques partagent la même table, distingués par `kind`. Une seule requête de proximité et une seule fiche de détail. Les lieux touristiques ne peuvent être créés que par l'équipe (RLS).

## D6 — Attributs d'annonce en `jsonb` validé côté serveur
Les champs propres à l'immobilier, l'emploi ou les véhicules varient. Colonnes communes (titre, prix, ville, position…) + `attributes` jsonb dont le schéma Zod dépend de `categories.attribute_schema`. Ajouter une catégorie ne demande pas de migration.

## D7 — Modération systématique, appliquée en base
Toute publication d'un utilisateur passe par « en attente » ; une modification d'une publication la renvoie en vérification. Matrices de transition dupliquées TypeScript/SQL et vérifiées identiques par test.

## D8 — Aucune donnée fictive
Le référentiel (ville, catégories, offres, paramètres) est chargé ; aucun commerce, annonce ou prix n'est inventé. Les tarifs Pro/Premium restent inactifs jusqu'à décision. La liste des quartiers est marquée « à valider ».

## D9 — Tests navigateur sur Edge installé
Playwright avec `channel: "msedge"` évite le téléchargement de navigateurs. En CI : `PW_CHANNEL=chromium`. Playwright permet aussi de simuler permissions et positions pour les tests de géolocalisation (§3.9.K).

## D10 — Validation SQL hors ligne
`libpg-query` (parseur officiel de PostgreSQL en WebAssembly) valide la syntaxe SQL et PL/pgSQL des migrations à chaque `npm test`, sans base. Ne remplace pas l'exécution réelle.

## D11 — Fusion des deux cahiers des charges (2026-10-17, arbitré par le porteur du projet)
Marque conservée (« Carrefour des Possibles », « Votre ville, mille opportunités ») ; « Tout San Pedro, au même endroit » devient l'accroche de la ville pilote. Navigation en quatre entrées : Annonces & Opportunités, Découvrir & Sortir, Services & Professionnels, 🧭 Nouveau à San Pedro ?. Construction en 28 niveaux.

## D12 — Drapeaux « demandé ET disponible »
Un drapeau seul permettrait d'afficher comme actif un service sans clé. L'état actif exige les deux. Conséquence : le site est cohérent quel que soit l'environnement, et la page de statut explique ce qui manque.

## D13 — Contrôle d'accès des pages internes dans le proxy
Avec le pré-rendu partiel, un `notFound()` exécuté dans un `<Suspense>` répond 200 (coque déjà envoyée), défaut détecté par le test de fumée. Les contrôles bloquants passent donc par `src/proxy.ts`, avec un contrôle de seconde ligne dans la page.

## D14 — Domaines métier dans `src/modules`
Les 18 domaines du plan sont regroupés par dossier avec une structure identique (domain / server / components / index). Les notions transverses restent dans `src/domain`.

## D15 — Vérification distincte de la modération
Deux axes : la **modération** (cycle de publication des contenus d'utilisateurs) et la **vérification** des données locales (`verified`, `pending_validation`, `placeholder`, `archived`, `rejected`, avec source, date et responsable). Voir `docs/data-governance.md`.

## D16 — Données de démonstration étiquetées
Autorisées par le second cahier des charges, à condition d'être `placeholder`, affichées « Exemple / à valider localement », isolées dans un seed distinct et supprimables en une opération.

## D17 — Mode hors ligne expérimental de Next.js (niveau 1)
`experimental.useOffline` détecte la perte de réseau et relance automatiquement navigations et actions bloquées : précieux sur réseau mobile instable. Risque : API expérimentale susceptible d'évoluer ; l'usage est confiné à `OfflineBanner` et peut être retiré sans impact fonctionnel.

## D18 — Émission complète des jetons (`@theme static`)
Tailwind 4 n'émet que les variables utilisées par des classes ; l'aperçu du design system et les styles en ligne affichaient des couleurs vides. Toutes les variables sont désormais émises (coût : quelques centaines d'octets).

## D19 — Migrations par l'API d'administration Supabase
Le port PostgreSQL direct est devenu inaccessible depuis le poste (bannissement automatique après des échecs d'authentification) et le mot de passe de base n'était pas disponible. `scripts/db.mjs` accepte donc deux transports : `DATABASE_URL` (préféré en CI) ou `SUPABASE_ACCESS_TOKEN` (API HTTPS). Même traçabilité que la CLI Supabase. Le jeton est sensible : à révoquer après usage.

## D20 — Tests de sécurité sur la base réelle
La validation syntaxique ne suffit pas : la première exécution réelle a révélé qu'un membre pouvait écrire dans le journal d'administration (fonction `SECURITY DEFINER` où `current_user` vaut le propriétaire). Les règles d'accès sont désormais vérifiées par scénarios SQL (`supabase/tests/*.sql`, `npm run db:verify`) exécutés dans une transaction annulée. Règle ajoutée : dans une fonction `SECURITY DEFINER`, le contexte système se teste avec `is_service_request()` (rôle du jeton), jamais avec `current_user`.

## D21 — Confidentialité garantie par les droits sur les colonnes
La position précise et les coordonnées de contact ne sont pas filtrées par l'interface mais rendues illisibles pour les rôles de l'API (droits PostgreSQL par colonne). Le public lit une position dérivée (`location_public`). Coût : `select("*")` interdit sur ces tables ; rappeler `grant_public_columns()` après tout ajout de colonne. Alternative écartée : vue publique séparée (double maintenance des règles RLS).

## D22 — Organisations distinctes des vitrines
`organizations` porte les membres et leurs rôles ; `business_profiles` reste la vitrine publique. Les contenus peuvent être rattachés à une organisation ; les droits passent par `can_manage_content()`, utilisé à la fois par les règles RLS et les déclencheurs.

## D23 — Quatre rôles d'équipe séparés
Modération (contenus des membres), éditeurs locaux (données de la ville), administrateurs (comptes, référentiel) et superadministrateurs (rôles d'administration). Un modérateur ne vérifie pas les données locales ; un administrateur ne crée pas d'administrateur.

## D24 — Données de démonstration visibles derrière un paramètre
Le paramètre `demo.public_placeholders` (activé pendant le pilote) contrôle en base la visibilité des exemples. Le désactiver fait disparaître tous les exemples du public sans les supprimer ; `demo_remove.sql` les supprime.

## D25 — Authentification Supabase, session vérifiée
Inscription et connexion par e-mail et mot de passe (Supabase Auth). L'identité est toujours établie par `getClaims()` (signature vérifiée), jamais par la session lue dans le cookie. Le proxy rafraîchit la session seulement si un cookie de session existe. Lecture de session précédée de `connection()` : la vérification du jeton lit l'heure, interdit dans un pré-rendu (défaut trouvé par les tests navigateur). Déconnexion locale à l'appareil (`scope: "local"`). Téléphone, OTP et OAuth : non activés (aucun fournisseur configuré), l'architecture (`verifyOtp`, route de confirmation) les accepte.

## D26 — Anti-énumération et anti-abus
Inscription et mot de passe oublié répondent toujours la même chose ; la connexion ne distingue pas e-mail et mot de passe faux. Limitation de débit par IP et par adresse visée, en base (`consume_rate_limit`, appelable uniquement par le serveur), avec empreintes HMAC purgées toutes les heures (`pg_cron`). `RATE_LIMIT_SCALE` relève les limites pour les tests automatisés seulement.

## D27 — Configuration d'authentification versionnée
`npm run db:auth-config` applique depuis le dépôt la politique de mot de passe (10 caractères, lettres et chiffres), la ré-authentification pour changer de mot de passe et les adresses de redirection. Les modèles d'e-mails français (`supabase/templates/`) ne sont applicables qu'avec un SMTP personnalisé (refus de Supabase sur l'offre gratuite) ; la route `/auth/confirmation` accepte les deux formats de lien (`token_hash` et `code`).

## D28 — Suppression de compte avec conservation pseudonymisée
La suppression efface le compte et ses contenus personnels, mais conserve détachés du compte : fiches de lieux (donnée locale), paiements, abonnements et campagnes (obligations comptables). Défaut trouvé en réel : un utilisateur ayant payé ne pouvait pas supprimer son compte (correctif `…000900`).

## D29 — Troisième statut de route : `preview`
Le niveau 4 exige que toutes les rubriques majeures soient accessibles avant que leurs contenus existent. Une route `preview` a une vraie page (écran d'attente explicite, catégories réelles lues en base, liens utiles), des liens actifs, mais reste hors sitemap et en `noindex` (contenu mince). `hasPage()` gouverne les liens, `isLive()` l'indexation. Remplace l'ancien principe « Bientôt, non cliquable », conservé seulement pour les routes `planned` (détails, espace pro, administration).

## D30 — Navigation : quatre entrées, deux lignes, barre basse
Ordinateur : en-tête (recherche, ville, favoris, compte, Publier) + barre des trois rubriques et de l'accès signature « Nouveau à San Pedro ? ». Mobile : en-tête minimal (logo, ville, menu) et barre basse à cinq onglets (Accueil, Rechercher, Publier, Favoris, Compte) dans la zone du pouce, avec marge basse du corps pour ne jamais masquer le contenu (vérifié par test).

## D31 — Service worker limité à la page « Hors ligne »
Un service worker qui met en cache des pages risquerait d'afficher une annonce retirée ou un prix modifié. Le nôtre ne met en cache que `/hors-ligne`, servie uniquement quand une navigation échoue faute de réseau ; tout le reste passe par le réseau. Enregistré en production seulement.

## D32 — Maintenance par le proxy, en 503
`FEATURE_MAINTENANCE=on` remplace toutes les pages publiques par `/maintenance` avec le code 503 et `Retry-After` (les moteurs de recherche ne désindexent pas le site), sauf la supervision (`/api/health`, `/interne`).

## D33 — Assistant visible mais honnête
Le lanceur « Demandez à San Pedro » est présent sur toutes les pages, sans gêner la navigation (au-dessus de la barre basse). Sans IA configurée, il le dit et oriente vers les parcours existants ; il ne simule aucune réponse.

## D34 — Délai maximal et journalisation des appels Supabase
Les tests ont révélé qu'une perturbation réseau pouvait figer un formulaire indéfiniment, puis, une fois un délai ajouté, afficher « mot de passe incorrect » ou « e-mail envoyé » à tort. Tous les clients Supabase côté serveur utilisent `fetchWithTimeout` (10 s), qui journalise les appels lents (≥ 3 s) et interrompus (chemin, durée, sans données personnelles). Les actions de compte distinguent la panne réseau (`isAuthRetryableFetchError`) d'un refus réel et affichent « momentanément indisponible ». Les tests navigateur autorisent une nouvelle tentative, signalée « flaky » dans le rapport.

## D35 — Accueil : coque statique, sections dynamiques indépendantes
L'accroche, la recherche et les accès rapides sont statiques (affichage immédiat, même réseau lent). Les quatre sections (annonces récentes, découvrir, commerces et professionnels, événements à venir) sont lues en parallèle derrière `<Suspense>`, par ville, avec un cache de quelques minutes ; l'échec d'une section n'empêche pas les autres de s'afficher.

## D36 — Recommandations déterministes et affichées
Pas de profilage ni de mise en avant payante à ce stade. Règles publiques (`src/domain/recommendation.ts`), affichées sous chaque section (« Pourquoi ces contenus ? ») : annonces par date de publication ; lieux par vérification à jour puis mise à jour récente ; événements par proximité dans le temps, jamais passés, annulations signalées.

## D37 — Aucune photo inventée
Tant qu'un contenu n'a pas de photo réelle, sa carte porte un visuel neutre (icône de catégorie sur fond teinté), jamais une image d'illustration qui pourrait passer pour le lieu réel.

## D38 — Parcours « Nouveau à San Pedro ? » : règles fixes, réponses dans l'adresse
Le plan est calculé par une fonction pure (`src/modules/newcomer/domain/plan.ts`) à partir de choix catégoriels uniquement (motif, durée, budget sans montant, logement, déplacements, priorités, centres d'intérêt) : aucune donnée personnelle, aucun prix estimé, aucune IA. Les priorités choisies passent en tête ; chaque bloc dit « Pourquoi ce conseil ? » et n'affiche que des contenus réellement publiés dans la ville (avertissement si non vérifiés, état vide sinon). Les réponses voyagent dans l'adresse du plan (partageable, rechargeable, sans compte) ; le brouillon du questionnaire reste dans le navigateur (`localStorage`) ; l'enregistrement dans le compte (`newcomer_plans`) est facultatif, lisible par son seul propriétaire (pas même la modération) et supprimable depuis le plan ou le profil. Une adresse incomplète ou invalide affiche « Ce plan est incomplet » plutôt qu'un plan approximatif.

## D39 — Recherche : une fonction SQL appelée avec les droits du visiteur
La recherche (`search_matches` / `search_content` / `search_counts`) s'exécute en SECURITY INVOKER : les règles d'accès et les droits par colonne s'appliquent comme pour une lecture directe, aucune position exacte ni coordonnée ne peut fuiter. Elle ne renvoie que des identifiants, une distance et un total ; les cartes sont ensuite lues avec les mêmes colonnes publiques qu'ailleurs. Texte : préfixes sans accents (plein texte français) + trigrammes sur les titres pour les fautes de frappe ; pas de moteur externe tant que le volume reste modeste (à réévaluer au-delà de quelques dizaines de milliers de contenus : la fonction PL/pgSQL matérialise les correspondances avant le tri).

## D40 — Recherche : types séparés, adresse canonique, tri public
Les résultats sont groupés par type (aperçu à 3 résultats par type, puis onglets paginés) : une annonce n'est jamais mélangée à un article du guide. Tous les critères sont dans l'adresse, sous une forme canonique unique (valeurs invalides, champs vides et tri par défaut retirés par une redirection). Changer d'onglet conserve le texte et les critères communs (quartier, vérifiés, rayon) et abandonne les filtres propres à un type. Les règles de tri sont affichées (« Pourquoi cet ordre ? ») ; aucun résultat sponsorisé.

## D41 — Langage courant : règles fixes, réversibles, sans critère inventé
« studio à louer près de moi », « activité ce week-end », « moins de 100 000 F », « à Bardot » sont traduits en filtres par des règles fixes (`natural-language.ts`) : seules des expressions explicites sont reconnues, une catégorie ou un quartier absents du référentiel ne sont jamais appliqués, les critères compris sont affichés et « Rechercher plutôt le texte exact » annule l'interprétation. L'interprétation ne s'applique qu'à une saisie libre ; dès le premier clic, l'adresse devient explicite. Une future interprétation par IA (drapeau `ai_search`) devra produire le même format et respecter les mêmes contraintes.

## D42 — Position du visiteur : cookie court, jamais dans l'adresse
La position n'est demandée qu'au clic sur « Utiliser ma position », arrondie à ~100 m, gardée 30 minutes dans un cookie du navigateur et jamais enregistrée par la plateforme. Elle n'apparaît pas dans l'adresse : partager une recherche « autour de moi » ne révèle pas où l'on se trouve ; la personne qui l'ouvre doit autoriser sa propre position. Sans position, le tri et le filtre par distance sont désactivés et l'interface l'explique.

## D43 — Statistiques de recherche agrégées et anonymes
Chaque recherche avec texte incrémente un total quotidien (ville, type, texte normalisé, nombre sans résultat) après la réponse (`after`), via une fonction réservée à la clé secrète du serveur. Ni compte, ni IP, ni position, ni identifiant ; chiffres et e-mails masqués en base ; conservation 180 jours ; lecture réservée aux administrateurs. Objectif : repérer les recherches sans résultat pour orienter la collecte de contenus.

## D44 — Contact : la messagerie par défaut, les coordonnées sur accord
Le canal de contact d'une annonce est la messagerie interne : aucune coordonnée n'est échangée par défaut. Un téléphone, un WhatsApp ou un e-mail ne sont proposés que si l'annonceur a coché leur partage ; ils ne s'affichent qu'à un membre connecté, 20 par heure au plus, et chaque affichage est tracé 90 jours (lutte contre la collecte en masse). Toutes ces règles sont en base (fonctions SECURITY DEFINER), donc valables aussi pour un appel direct à l'API. Une annonce expirée, archivée, indisponible ou d'un annonceur suspendu ne peut plus être sollicitée.

## D45 — Commentaires publics sans coordonnées, réponse réservée à l'annonceur
Les questions publiques refusent tout numéro (8 chiffres ou plus) et toute adresse e-mail : l'échange privé passe par la messagerie. Seul l'annonceur répond (un niveau), il peut masquer un commentaire ; l'auteur supprime le sien ; un texte publié ne se réécrit pas ; l'équipe modère. Tout commentaire est signalable.

## D46 — Pages dynamiques et menus sous Suspense
Avec Cache Components, une adresse dynamique (`/annonces/[slug]`, `/messages/[id]`) n'est pas connue au prérendu : les menus qui lisent l'adresse (barre basse, navigation principale) sont placés sous `<Suspense>`, avec en repli le même menu sans élément actif (aucun saut de mise en page).

## D47 — Niveau 8 : périmètre livré et reporté
Livré : fiche complète, favoris, « j'aime », partage, commentaires, signalement, contact, messagerie, similaires, états, données structurées. Reporté : galerie photo (avec l'ajout de photos, niveau 18 — un visuel neutre l'indique, aucune image inventée) ; compteur de vues (tables et fonction en base, non alimentées) ; temps réel instantané de la messagerie (la base diffuse les messages, l'interface rafraîchit le fil toutes les 20 s quand l'onglet est visible).

## D48 — Immobilier : quatre entrées, attributs déclarés, aucune promesse
Location, vente, séjour temporaire (facturé à la nuit ou à la journée) et locaux professionnels correspondent à des catégories du référentiel (administrables). Les filtres portent sur les attributs déclarés par l'annonceur (`listings.attributes`), lus de façon sûre en base (`attr_int`, `attr_bool` : une valeur mal typée est ignorée, jamais une erreur) ; un filtre inadapté à l'entrée n'est pas proposé (ni pièces ni mobilier pour un local). Le budget filtre les prix annoncés : ni estimation, ni conseil financier, ni prix moyen par quartier, et aucun quartier n'est présenté comme « meilleur ».

## D49 — Fraîcheur des annonces immobilières
La disponibilité est déclarative : une annonce publiée ou confirmée par l'annonceur il y a plus de 30 jours est signalée « à reconfirmer » sur la carte et la fiche, avec le conseil de vérifier avant de se déplacer ; un filtre « confirmées depuis moins de 30 jours » est proposé. Une annonce expirée n'apparaît plus (niveau 8).

## D50 — Comparaison et conseils
La comparaison (3 biens au plus) est gardée dans le navigateur seulement et passe par l'adresse (`?annonces=a,b,c`) ; elle n'est pas indexée et n'est pas un classement. La page de conseils combine des règles de prudence générales (aucune donnée locale) et les articles « Se loger » du guide, administrables, avec source et statut de vérification.

## D51 — Formulaires de filtres recréés à chaque recherche
Une navigation vers la même page avec d'autres critères conserve les composants : des champs non contrôlés garderaient leurs anciennes valeurs. Les formulaires de filtres (recherche générale, immobilier) ont donc pour clé la forme canonique des critères et se recréent quand elle change.

## D52 — Services : du besoin au métier par mots-clés administrables
« Ma climatisation ne fonctionne plus » est rapproché d'un métier par les mots-clés du référentiel (sans accents, mot-clé le plus long l'emporte), sans intelligence artificielle ; le métier reconnu et le mot déclencheur sont affichés. Une urgence exprimée est signalée mais ne devient jamais une promesse de disponibilité. Les métiers et leurs mots-clés se modifient en base, sans déploiement.

## D53 — Disponibilité déclarée et datée, horaires seulement vérifiés
La disponibilité d'un professionnel est une déclaration datée par la base, affichée avec sa date et la mention « rien n'est garanti en temps réel » ; le filtre « disponibles » retient les déclarations de moins de 30 jours. Les horaires ne sont annoncés que si la fiche a été vérifiée récemment. L'ordre des résultats est public (« Pourquoi cet ordre ? ») et rien n'est payant.

## D54 — Demande de devis : accord explicite, suivi par le destinataire
Une demande de devis est structurée (prestation, délai, quartier, besoin) et n'est envoyée qu'avec une case d'accord non cochée par défaut ; l'accord est daté en base et exigé par une contrainte. Le professionnel retrouve les coordonnées dans « Mes demandes de devis » avec la date de l'accord, et ne peut modifier que le statut ; l'expéditeur suit ce statut. Les comptes de test e2e suppriment leurs demandes au nettoyage.

## D55 — Niveau 10 : périmètre livré et reporté
Livré : métiers administrables, recherche de professionnels (métier, quartier, distance, disponibilité déclarée, vérification, mode de contact), annonces de service du métier, fiche professionnelle, devis avec accord, suivi des demandes. Les métiers se gèrent depuis `/admin/categories` (administrateurs ; premier écran de l'administration du niveau 22). Reporté : édition de la fiche par le professionnel (espace pro, niveau 21), photos de réalisations (avec l'envoi de photos, niveau 18), avis clients, horaires détaillés.

## D56 — Référentiel : administré, historisé, jamais supprimé
Les catégories (métiers, rubriques, types de commerces) se modifient depuis `/admin/categories` : nom, mots-clés, ordre, activation, ajout de sous-catégories qui héritent de la famille, des types de contenus et des attributs du parent. L'adresse (slug) d'une catégorie existante ne change pas, car elle peut être partagée ; une catégorie se désactive plutôt que d'être supprimée. Les droits sont en base (`categories_admin_write`), chaque modification est historisée (`content_revisions`) et le cache public est invalidé immédiatement (`updateTag`).

## D57 — Commerces : la vitrine est un lieu tenu par l'équipe locale
Un commerce n'est pas une annonce : sa vitrine est un lieu (`places`, type « établissement »), créé et vérifié par l'équipe locale, que l'exploitant peut revendiquer. Les vues spécialisées (restaurants, alimentation, boutiques, quincaillerie, téléphonie, auto…) sont des catégories du référentiel : en ajouter une se fait depuis `/admin/categories`, sans déploiement. La vitrine (`/lieux/[slug]`) sert aussi aux lieux touristiques, que le niveau 12 enrichira.

## D58 — Horaires : vérifiés et sourcés, ou « à confirmer »
Des horaires ne sont présentés comme vérifiés qu'avec une date de vérification de moins de 6 mois et une source (relevé terrain, déclaration de l'exploitant contrôlée…). Sinon la vitrine affiche « Horaires à confirmer » ; sans horaires, « non renseignés ». « Ouvert / fermé maintenant » précise toujours s'il repose sur des horaires vérifiés ou à confirmer. Seule l'équipe locale peut marquer des horaires comme vérifiés (règle en base).

## D59 — Revendication : vérifiée par une personne, jamais automatique
L'exploitant fournit un élément vérifiable (registre du commerce, facture, carte professionnelle) et un téléphone vus par l'équipe seulement. Un éditeur local ou un administrateur valide ou refuse (motif obligatoire, transmis au demandeur, qui suit sa demande dans son profil). Validée, la revendication fait de l'exploitant le destinataire des messages ; elle ne change ni la vérification ni l'ordre. La modification de la vitrine par l'exploitant viendra avec l'espace pro (niveau 21).

## D60 — Mise en avant sponsorisée : à part et étiquetée
Les vitrines sponsorisées (campagne active et en cours, 2 au plus) apparaissent dans un bloc séparé « Mis en avant », chacune avec l'étiquette « Sponsorisé » et l'explication qu'elles ne modifient ni l'ordre ni la vérification. Aucun paiement n'est encore possible (niveau 21) : aucune campagne ne peut devenir active sans l'équipe.

## D61 — Budget, ambiance, services : indicatifs et déclarés
Le budget est un ordre de grandeur (petit budget → haut de gamme), jamais un prix ; services et ambiance sont des listes fermées, contrôlées en base ; les produits sont des libellés libres, « sans garantie de stock ni de prix ». Aucune photo d'illustration : la galerie n'affiche que des photos réellement déposées.

## D62 — Liens de menu vers une page filtrée
Chaque page a sa forme canonique d'adresse (`/services?metier=…`, `/commerces?type=…`) : les menus et le plan nouvel arrivant passent par `categoryHref`, qui emploie le bon critère. Auparavant, `?categorie=` était retiré par la redirection canonique de `/services` (filtre perdu).

## D63 — Tourisme : un seul modèle de lieu, quatre entrées
Hébergements, restaurants, sites, activités et opérateurs sont des lieux du référentiel ; « Où dormir ? », « Où manger ? », « Que découvrir ? » et « Sortir » (`/decouvrir/[entree]`) regroupent des catégories administrables, `/tourisme` les explore toutes avec les mêmes filtres. « Sortir » ajoute les événements à venir. Les opérateurs (`excursions-guides`) sont des établissements revendicables : on les contacte par la messagerie une fois revendiqués.

## D64 — Itinéraire : règles fixes, rien d'inventé
Le créateur d'itinéraire (`/tourisme/itineraire`) compose une demi-journée, une journée ou deux jours avec les seuls lieux publiés : vérifiés d'abord, puis thèmes choisis, puis le plus proche de l'étape précédente. Public, budget et accessibilité sont impératifs, et une information absente ne les satisfait pas. Un moment sans lieu adapté est signalé « à compléter localement », jamais comblé. Matin, midi, soir sont des repères, pas des horaires ; seule la distance à vol d'oiseau entre deux lieux connus est donnée, sans durée de trajet ni moyen de transport. La demande est dans l'adresse (partageable) ; même demande et mêmes lieux donnent le même itinéraire.

## D65 — « Information à confirmer localement »
Chaque donnée touristique manquante (thèmes, public, durée, accessibilité, conditions d'accès, source, date de vérification) est affichée « Information à confirmer localement ». Les pages restent utiles sans données vérifiées : entrées, filtres, itinéraire honnête, conseils de prudence généraux (aucune donnée locale), liens vers le guide et les quartiers. Le centre-ville, approximatif, ne sert à aucun calcul de distance.

## D66 — Guide : Markdown restreint rendu sans HTML
Les articles sont écrits dans un Markdown restreint (titres, listes, encadrés, gras, italique, liens) lu en arbre puis rendu en éléments React : aucun HTML brut, seuls les liens internes et https sont actifs. Les titres alimentent le sommaire (ancres stables). Pas de bibliothèque ajoutée.

## D67 — Guide : versions, modération et statut annoncé
Chaque modification du texte crée une version avec sa note, consultable par l'équipe (texte complet) et par le public (date et note). Un article publié non vérifié porte « Contenu à confirmer localement » ; une vérification de plus d'un an, « vérification ancienne » ; chaque article rappelle qu'il s'agit d'une orientation générale, pas d'un conseil juridique, médical, administratif ou financier personnalisé. Les lecteurs suggèrent des corrections, traitées par l'équipe (`/admin/guide`), jamais publiées telles quelles.

## D68 — Guide relié au site et préparé pour l'assistant
Chaque rubrique liste ses ressources réelles (services, commerces, tourisme, immobilier, recherche) avec le nombre de contenus publiés ; une catégorie vide est annoncée sans lien, la carte n'est proposée qu'une fois sa page ouverte. La recherche du guide utilise le moteur du site (type « guide ») et renvoie vers la recherche générale. Les articles publiés alimentent automatiquement les documents de l'assistant, découpés en passages, avec leur statut et leur source.

## D69 — Quartiers : sans frontière figée, sans qualificatif
Un quartier existe sans périmètre ; les contenus lui sont rattachés par la relation déclarée (`neighborhood_id`), jamais par un calcul de proximité qui figerait une frontière. Une fiche sans périmètre validé le dit, une fiche non vérifiée aussi. Aucun quartier n'est classé ni qualifié (sûr, calme, riche, pratique, dangereux…) : la liste est alphabétique et chaque fiche le rappelle ; la description, rédigée par l'équipe, reste factuelle.

## D70 — Périmètres : brouillon, validation, historique
Un périmètre se propose en GeoJSON (contrôlé en base), se prévisualise, puis se valide ou se refuse avec motif ; seul un brouillon validé est publié, l'ancien est conservé comme « remplacé », un retrait exige un motif. Toute modification passe par ces fonctions : elle est au journal d'administration et dans l'historique des révisions. La saisie à main levée sur carte viendra avec la carte interactive (niveau 15).

## D71 — Liste des quartiers en un appel
La liste des quartiers et le nombre de contenus rattachés viennent d'une seule fonction (`neighborhood_overview`) : vingt appels parallèles depuis San Pedro dépassaient parfois le délai réseau et faisaient échouer toute la page.

## D72 — Carte : fournisseur configurable, liste toujours présente
Le fond de carte vient de `NEXT_PUBLIC_MAP_TILE_URL` (OpenStreetMap par défaut, sans clé) ; Leaflet est chargé seulement dans le navigateur. Sans carte (drapeau désactivé, tuiles ou script indisponibles), la liste des mêmes éléments reste utilisable, avec quartier et lien vers la fiche. Carte et liste partagent les mêmes données : un clic d'un côté sélectionne l'élément de l'autre et ouvre une fiche rapide.

## D73 — Carte : sobriété des requêtes et regroupement maison
La carte ne recharge rien d'elle-même : déplacer ou zoomer propose « Rechercher dans cette zone », qui met la zone dans l'adresse (une requête par demande, 300 éléments au plus, message s'il y en a davantage). Les marqueurs proches sont regroupés par une grille de pixels calculée selon le zoom (fonction pure testée), sans bibliothèque supplémentaire. Les points du guide n'ont pas de position : la couche est annoncée comme indisponible, avec la raison.

## D74 — Carte : confidentialité et itinéraire
Seules les positions publiques sont affichées ; une position approximative est dessinée en pointillés et n'ouvre pas d'itinéraire. « Autour de moi » reprend la position facultative du niveau 7 (accord explicite, arrondie à ~100 m, 30 minutes dans le navigateur, jamais dans l'adresse). L'itinéraire s'ouvre dans OpenStreetMap : la plateforme ne prétend pas guider.

## D75 — Comptes de test : nettoyage robuste
Chaque appel d'administration des tests est retenté (réseau du poste instable) ; au démarrage, les comptes de test orphelins (adresses `e2e-…@test.invalid` seulement) d'une exécution interrompue sont supprimés.

## D76 — Événements : le temps d'abord, jamais de passé « à venir »
L'agenda (`/evenements`) ne liste que des événements non terminés, du plus proche au plus lointain, groupés par jour ; le calendrier mensuel grise les jours passés et ne remonte pas avant le mois courant. La fiche d'un événement terminé le dit, puis l'événement est archivé 30 jours après sa fin. Aucune programmation n'est inventée : l'agenda vide le dit.

## D77 — Report et annulation : visibles, motivés, notifiés
Un report ou une annulation ne renvoie pas l'événement en modération (sinon il disparaîtrait au moment où le public doit être prévenu) : il reste publié avec un bandeau (« Annulé » avec le motif, « Reporté » avec la date initiale et la nouvelle), et les personnes qui l'ont en favori reçoivent une notification. Seuls l'organisateur, son organisation ou l'équipe peuvent le faire (fonction en base).

## D78 — Proposition modérée, rappels sans données personnelles
Tout membre peut proposer un événement ; il est publié après décision de l'équipe de modération (refus motivé), l'organisateur est notifié. Les rappels passent par les favoris (notification la veille) ou par un fichier d'agenda `.ics` que la personne importe et règle elle-même. Les dernières notifications s'affichent dans le profil en attendant le centre de notifications (niveau 24).

## D79 — Offres : modérées, datées, sans adresse inventée
Toute offre est relue avant publication (refus motivé, auteur notifié). La date limite fixe l'expiration ; une offre close, expirée ou dont la date est passée n'accepte aucune candidature, règle garantie en base. Une offre n'exige pas de position : la fiche n'affiche pas de « zone approximative » fictive. Clôturer une offre (disponibilité) ne la renvoie pas en modération ; modifier son texte, si.

## D80 — Candidatures et profils candidats privés par défaut
Une candidature n'est visible que du candidat et de l'employeur ; seul son statut change, le candidat peut la retirer, l'employeur décide et le candidat est notifié. Aucun tri ni décision automatique sur un candidat. Le profil candidat est privé par défaut ; le candidat choisit sa visibilité (employeurs ou public) et le partage de ses coordonnées, révélées une à une par fonction en base, jamais lisibles directement.

## D81 — Règles de formulation et import sans IA
Les formulations discriminatoires (âge, sexe, origine, religion, situation familiale, apparence, santé), les demandes d'argent au candidat et les gains irréalistes sont bloqués à la publication par des règles explicables, et signalés au modérateur. Une offre vue sur LinkedIn se publie en collant son texte : un pré-remplissage déterministe propose titre, contrat, date limite et contact, que l'auteur vérifie ; rien n'est récupéré automatiquement sur LinkedIn (conditions d'utilisation) et l'aide IA viendra aux niveaux 18 et 26, sans publication ni décision automatique. Une candidature externe n'accepte qu'un lien https, affiché avec le nom du site.

## D82 — Publication : brouillon privé d'abord, modération ensuite
Choisir une catégorie crée un brouillon privé, incomplet accepté, enregistré automatiquement ; seule la soumission exige titre, description et position (règle en base). Un aperçu précède la soumission ; l'équipe publie ou refuse avec motif, et l'auteur est notifié. Une annonce refusée ou retirée de la modération redevient un brouillon. La modification d'une annonce déjà publiée attend le tableau de bord (niveau 20) : l'enregistrement automatique ne doit jamais retirer une annonce en ligne à la première frappe.

## D83 — Photos privées jusqu'à la publication
Les photos d'une annonce vont dans le stockage privé (auteur et équipe, adresses signées) ; à la publication, le serveur les copie dans le stockage public avec la clé secrète, après vérification du rôle de modérateur. Le navigateur contrôle format, poids et résolution, et calcule une empreinte SHA-256 : une photo identique dans l'annonce d'un autre compte est signalée à l'auteur et au modérateur (indice de reprise d'annonce), sans révéler l'autre annonce.

## D84 — Assistant de saisie : proposer, jamais décider
Des règles fixes repèrent prix, unité, téléphone et caractéristiques dans un texte collé ; l'IA, facultative, fait de même pour un texte, une photo ou un PDF. Aucune suggestion n'écrit dans l'annonce : chacune affiche sa source, sa confiance et l'extrait qui la justifie, et l'auteur l'applique, l'ignore ou l'annule ; chaque décision est tracée en base et visible du modérateur. Une suggestion de l'IA sur un texte dont l'extrait ne figure pas dans la source est écartée ; sur une photo ou un PDF, la confiance est plafonnée et l'interface rappelle de vérifier. Un PDF est lu en mémoire puis oublié. Le parcours complet fonctionne sans IA.

## D85 — IA : activable, budgétée, modèle configurable
L'assistant IA n'est actif que si le drapeau `ai_publishing`, le fournisseur (`AI_PROVIDER=anthropic`), la clé et la clé secrète (suivi du budget) sont présents, et tant que le coût estimé du mois reste sous `AI_MONTHLY_BUDGET_EUR` (coût en dollars comparé au budget en euros : plafond atteint un peu plus tôt, par prudence). Modèle par défaut `claude-opus-5-5` (modifiable par `AI_MODEL`), effort bas pour une extraction, sortie structurée validée, repli automatique côté fournisseur en cas de refus ; 30 appels par personne et par jour. SDK officiel `@anthropic-ai/sdk`.

## D86 — Contenus interdits bloqués avant la modération
Armes, drogues, médicaments, espèces protégées, faux documents et contrefaçons, données personnelles, demandes d'argent avant visite et promesses de gain bloquent la soumission par des règles expliquées, et sont signalés au modérateur s'ils passent. La modération humaine reste la garantie finale.

## D87 — Quatre badges, jamais confondus
« Vérifié » vient seulement de l'équipe locale, avec une source enregistrée et une date ; « En cours de validation » dit qu'une demande attend ; « Profil complété » dit que sept rubriques sont remplies (déclaratif) ; « Sponsorisé » signale une campagne active et ne change ni l'ordre de l'annuaire, ni la vérification, ni les avis. Chaque badge porte sa définition et renvoie à `/verification#badges`.

## D88 — Équipe par invitation à usage unique
Aucun annuaire de comptes n'est exposé : un administrateur de l'équipe crée un lien (rôle choisi, 7 jours), affiché une seule fois ; la base n'en garde que l'empreinte. La personne voit l'équipe et le rôle avant d'accepter. Rôles : propriétaire, administrateur (gère l'équipe), éditeur (modifie la page, répond aux avis), lecteur (consulte). Une équipe garde toujours un propriétaire.

## D89 — Avis : modérés et protégés contre la manipulation
Un avis vient d'un compte d'au moins 7 jours à l'adresse confirmée, un seul par page, jamais d'un membre de l'équipe, cinq par jour au plus ; il est relu avant publication. La moyenne n'apparaît qu'à partir de 3 avis publiés. Le professionnel répond publiquement sans pouvoir modifier la note ; un avis se signale comme tout contenu.

## D90 — Page professionnelle modérée, disponibilité libre
Une page est relue avant publication, et après chaque modification de contenu. La disponibilité et l'ouverture aux devis se mettent à jour sans relecture : elles sont affichées comme déclarées, avec leur date. Une page créée par l'équipe se revendique par le circuit des vitrines (élément vérifiable, décision motivée).

## D91 — IA de rédaction et offres sans paiement
L'aide à la rédaction (présentation, FAQ) n'utilise que les informations déjà saisies, refuse d'inventer prix, années, certifications ou garanties, et son texte n'est enregistré qu'après relecture. Les offres du référentiel sont affichées ; aucune somme n'est demandée tant qu'aucun prestataire de paiement n'est configuré, et aucune mise en avant ne s'achète.

## D92 — Un tableau de bord, un compte allégé
Le tableau de bord rassemble ce que la personne pilote (annonces, activité, notifications, confidentialité et données) ; `/profil` garde l'identité, le type de compte et les outils d'équipe. Navigation en onglets défilants sur mobile, listes en cartes plutôt qu'en tableaux. « Mes annonces » change d'adresse ; l'ancienne est redirigée avec ses paramètres.

## D93 — États compréhensibles, actions sensibles confirmées et historisées
Chaque état d'annonce est expliqué et ne propose que les actions que la base autorise. Archiver ou supprimer un brouillon exige une case de confirmation (vérifiée aussi côté serveur) ; la suppression du compte exige de saisir « SUPPRIMER ». L'historique des statuts et de la disponibilité vient du journal des révisions, sans saisie manuelle.

## D94 — Confidentialité appliquée par la base
Nom public, ancienneté, nombre d'annonces et indexation par les moteurs se règlent par la personne et s'appliquent dans les fonctions publiques (vendeur, commentaires, avis) et les métadonnées des annonces ; les préférences elles-mêmes ne sont lisibles que par leur titulaire. Couper une catégorie de notifications empêche leur création en base ; les décisions de modération, revendications et vérifications restent toujours envoyées.

## D95 — Statistiques sobres, limites dites
Vues (visiteurs distincts par jour, estimation), favoris, coordonnées vues et conversations : chaque chiffre a sa définition et ses limites à côté. Aucune comparaison ni classement entre annonceurs.

## D96 — Un espace par page, cloisonné par la base
L'espace professionnel s'ouvre page par page ; chaque lecture passe par une fonction qui vérifie l'appartenance à l'équipe de la page (sinon 404, sans révéler son existence). Lecteur : consultation ; éditeur : annonces, demandes, réponses ; administrateur : équipe ; titulaire : tout. Les coordonnées des clients ne sont visibles qu'à partir du rôle éditeur.

## D97 — Statistiques agrégées, vues réellement comptées
Les vues n'étaient enregistrées nulle part : elles le sont désormais après l'envoi de la page (aucune latence), pour un visiteur distinct par jour, robots, préchargements et annonceur exclus, sous forme d'empreinte HMAC du jour purgée le lendemain. L'espace pro n'affiche que des totaux, chacun défini ; aucun visiteur n'est identifiable et aucun classement entre professionnels n'est montré.

## D98 — Publier au nom d'une page
Depuis l'espace, une annonce ou une offre se publie au nom de la page : elle est rattachée à la page et à son équipe, ce que la base n'autorise qu'aux gestionnaires de la page. Elle suit la même modération ; la correction demandée apparaît dans l'espace et dans l'historique.

## D99 — Offres présentées, rien à payer
`/offres` et l'espace affichent les offres du référentiel, avec la mention explicite qu'aucun paiement n'est ouvert ni demandé tant que le drapeau `payments` (prestataire configuré) est inactif. Rien ne s'achète, la page reste gratuite et complète.

## D100 — Un back-office par rôle, des droits garantis par la base
`/admin` n'affiche que les outils du rôle. Modérateur : files de contenus et signalements, sans comptes, référentiel, doublons ni journal des actions sensibles. Éditeur local : données locales (qualité, doublons, sources, guide, quartiers, revendications), sans signalements. Administrateur : tout, sauf attribuer un rôle d'administration (superadministrateur). Chaque fonction SQL revérifie le rôle ; l'interface ne fait que masquer.

## D101 — Suspendre, c'est refuser avec motif
Pas de nouveau statut : un contenu suspendu après signalement passe en « refusé » avec le motif (annonce, lieu, événement, page) ou est masqué (commentaire, avis). Il disparaît aussitôt, son auteur reçoit le motif par une notification non désactivable et peut corriger puis resoumettre ; le cycle de publication reste le même. Un article du guide se retire depuis la rédaction ; un message privé conduit à sanctionner le compte.

## D102 — Journal obligatoire et alimenté par la base
Les changements de rôle et de suspension sont journalisés par un déclencheur, même hors du back-office. Toute décision sensible (sanction, signalement, fusion, campagne) exige une raison d'au moins 5 caractères et enregistre l'auteur, la date, l'avant et l'après. L'historique des contenus montre les champs modifiés, sans les champs techniques.

## D103 — Fusionner sans supprimer
Une fusion de lieux archive le doublon, le relie à la fiche conservée (`merged_into`) et y rattache favoris, « j'aime », avis (sauf auteur déjà présent) et événements ; ses signalements ouverts sont clos. Rien n'est supprimé, tout reste dans l'historique.

## D104 — L'IA ne décide pas dans le back-office
Les champs proposés par l'IA restent signalés dans la file des annonces et comptés au tableau de bord ; aucune décision n'est automatique. L'assistant d'administration (suggestions) est livré avec la couche IA (niveau 23).

## D105 — Recherche plein texte plutôt que vecteurs
Le fournisseur retenu ne propose pas de modèle d'embeddings et le volume local reste modeste : les passages vérifiés sont retrouvés par recherche plein texte française (sans accents, préfixes, rang par pertinence), dans la base, sans service tiers. La colonne `embedding` reste prête si un fournisseur est ajouté.

## D106 — Citer ou se taire
L'assistant reçoit les passages comme documents avec citations activées ; seules les sources effectivement citées sont affichées, avec leur date de vérification. Sans passage vérifié, il répond « Je ne dispose pas d'information vérifiée » sans appeler le modèle ; une réponse sans citation n'est jamais affichée. Sans IA, les passages trouvés sont présentés tels quels avec leurs sources.

## D107 — Les contenus sont des données
Questions, documents et annonces envoyés au modèle sont nettoyés (caractères invisibles, formulations de consignes, balises) et présentés comme données ; les consignes système le rappellent. Les sorties sont revalidées par le code (référentiel, montants, mots réellement écrits, numéros de documents).

## D108 — L'IA propose, l'équipe décide
Recherche : critères proposés en dernier recours et annoncés comme tels. Modération : suggestion affichée à la demande, jamais appliquée. Publication : suggestions validées champ par champ (niveau 18). Aucun outil IA ne publie, ne refuse ni ne sanctionne.

## D109 — Coupure, quotas et sobriété
Un drapeau par usage, un interrupteur général en base (coupure sans redéploiement, journalisée), un budget mensuel, des quotas par personne (20 questions par heure, 40 recherches IA par jour). La consommation est enregistrée sans contenu ; la question n'est jamais conservée.

## D110 — Une file d'envoi alimentée par la base
Toute notification, quelle que soit son origine (action, déclencheur, tâche planifiée), passe par la même file : la base décide du canal selon les préférences, une tâche serveur envoie. Un envoi est réservé avant traitement (jamais deux fois), la clé d'idempotence est transmise au fournisseur, les échecs sont retentés puis abandonnés avec un code d'erreur, jamais le contenu.

## D111 — Informer sans spam
Une seule notification non lue par conversation, une relance par échéance d'annonce, une alerte par recherche et par jour au plus, dédoublonnage par clé ; les e-mails ne contiennent ni le texte des messages ni de coordonnées. Les alertes et rappels portant sur des contenus non vérifiés sont formulés au conditionnel.

## D112 — Le choix de la personne, par canal
Chaque catégorie se règle sur le site et par e-mail ; « aucun e-mail » coupe tout, y compris les décisions (qui restent affichées sur le site). Chaque e-mail permet de se désabonner de sa catégorie sans connexion : lien signé, confirmation par bouton (un antivirus qui ouvre le lien ne désabonne pas) et désabonnement en un clic par la messagerie (RFC 8058).

## D113 — Fournisseurs facultatifs
E-mail : Resend si configuré ; sans fournisseur, simulé dans la console en développement et ignoré en production (statut « ignoré », jamais « envoyé »). Push et SMS : abstraction prête, aucun envoi tant qu'aucun fournisseur n'est branché. Les e-mails de compte (vérification, réinitialisation) restent ceux de Supabase Auth.

## D114 — Une adresse indexable par contenu
Rubriques : seuls la catégorie (ou le type, le métier) et la page forment une adresse canonique ; texte, prix, tri, quartier, distance créent des variantes non indexées dont la canonique pointe vers la rubrique (liens suivis). La recherche reste non indexée. Fiches : canonique propre, partage social ; exemples de démonstration et annonces des membres qui refusent l'indexation exclus (noindex et sitemap).

## D115 — Données structurées seulement si l'information est vérifiée
Event, LocalBusiness et TouristAttraction ne sont publiés que pour un contenu vérifié (source, date, responsable) ; un événement passé n'en a plus. Champs vides omis, jamais complétés ; un professionnel n'expose jamais son adresse ; le site officiel n'est cité que s'il est en https. Les annonces gardent leurs règles (niveau 8).

## D116 — Budget de performance mesuré hors navigateur
Le budget porte sur le poids compressé des ressources du site au chargement initial (JavaScript 230 Ko, total 300 Ko hors images et tuiles), le CLS (0,1) et un LCP bloquant à 4 s en local (objectif 2,5 s en production). Les ressources sont retéléchargées puis compressées par le test : sur le poste de développement, un antivirus réécrit le trafic du navigateur.

## D117 — Audit d'accessibilité automatique et bloquant
axe-core contrôle les règles WCAG 2.2 A et AA sur les pages publiques et connectées principales, sur mobile et ordinateur ; une violation grave ou critique fait échouer `npm run check`. L'audit manuel (lecteurs d'écran réels, zoom) reste à mener avant le lancement.

## D118 — Vérifier le fichier, pas sa déclaration
Le navigateur dépose la photo dans le stockage privé ; le serveur la relit avant de l'enregistrer : signature d'image, taille, empreinte SHA-256. Le type annoncé par le navigateur et le nom du fichier ne sont jamais crus. Sans fournisseur d'antivirus, seuls des formats d'image sont acceptés.

## D119 — Un défi anti-robot sans traçage
Champ piège invisible et délai minimal de saisie sur les formulaires anonymes (inscription, mot de passe oublié), en plus de la limitation de débit ; un robot reçoit la même réponse qu'un humain. Pas de CAPTCHA tiers (dépendance, traçage, accessibilité) tant que les abus ne l'exigent pas.

## D120 — La fraude se signale, elle ne se sanctionne pas automatiquement
Les indices de fraude forment un score montré à l'équipe (file des annonces, `/admin/fraude`, alerte au-delà de 5). Toute suspension reste une décision humaine motivée, et chaque décision est contestable par recours, tranché par une autre décision humaine journalisée.

## D121 — Charte de confiance et accord de transaction
L'annonceur s'engage à chaque soumission ; le visiteur accepte la charte avant son premier message, une fois par version (acceptation datée). L'accord imprimable formalise la transaction entre les parties ; la plateforme n'y est pas partie. Textes provisoires, à relire par un juriste avant le lancement.

## D122 — Politique de contenu sans nonce
La CSP interdit tout script, objet et cadre externes et limite les connexions à Supabase ; les scripts en ligne de Next restent autorisés, car un nonce imposerait un rendu dynamique de toutes les pages (perte du pré-rendu). À revoir si Next permet un hachage des scripts en ligne des pages statiques.

## D123 — Couverture mesurée là où vit la logique
La couverture est mesurée sur les règles métier, `lib`, la configuration et les composants ; l'objectif porte sur les règles métier (plus de 90 % des lignes). Pages, actions serveur et base sont vérifiées par les tests de bout en bout et les suites SQL, qui exercent les vraies règles d'accès plutôt que des simulations.

## D124 — L'IA se teste sans réseau
Les limites de l'IA (absence de source, contenu non vérifié, demande ambiguë, injection, référentiel inventé, coupure, quota) sont testées avec un modèle simulé : rapides, reproductibles, sans coût. L'essai avec le vrai modèle se fait en préproduction, budget plafonné.

## D125 — Les tests ne laissent aucune trace
Comptes et contenus de test portent des marqueurs dédiés (`@test.invalid`, `Zq…`, `Zqe2e…`) et sont supprimés, organisations comprises ; une suite SQL d'hygiène échoue s'il en reste plus d'un jour. Les exemples de démonstration restent distincts (statut `placeholder`, « Exemple — … »).

## D126 — Une arborescence de rubriques à quatre niveaux, garantie en base
Rubrique principale, sous-rubrique, sous-catégorie, catégorie détaillée. La base refuse un cinquième niveau, un cycle, une catégorie parente d'une autre famille ou un déplacement qui pousserait des sous-catégories au-delà de quatre niveaux (déclencheur `protect_category_tree`). Les rubriques Biens et objets et Véhicules sont des données (migration `20261108000100`), modifiables depuis `/admin/categories` ; aucune page publique ne code une catégorie en dur.

## D127 — On ne supprime une catégorie qu'en la vidant
Désactiver reste la règle : la catégorie disparaît des menus, filtres et formulaires, ses contenus restent rattachés. La suppression (`delete_category`) exige un administrateur, une raison, aucune sous-catégorie et une catégorie de reprise active de la même famille si des contenus y sont rattachés ; tout est déplacé puis journalisé (`categorie.suppression`). L'historique des contenus n'est pas touché.

## D128 — Le formulaire et les filtres suivent la catégorie
Le modèle de fiche (`attribute_schema` : bien, véhicule, pièce, immobilier…) fixe les champs proposés à la publication ; l'administration peut en désactiver par catégorie (`attribute_fields`). Les filtres de « Toutes les annonces » sont les champs filtrables actifs de la catégorie choisie : un meuble n'a ni kilométrage ni carburant, une pièce détachée n'impose pas les champs d'un véhicule complet. Un filtre étranger à la catégorie est retiré de l'adresse. État, marque, kilométrage… sont déclarés par l'annonceur, jamais présentés comme vérifiés.

## D129 — « Toutes les annonces » sans les offres d'emploi
La page agrège les annonces publiées et visibles de toutes les rubriques (biens, véhicules, immobilier, services, formation). Les offres d'emploi, opportunités et appels d'offres gardent leur rubrique `/emploi` (salaire, contrat, candidature) : un lien y mène. Recherche par une fonction en base (`search_listings`, droits de la personne qui cherche), sans cache.

## D130 — Le temps réel signale, le serveur affiche
Un déclencheur diffuse sur le canal public « annonces » l'identifiant de toute annonce visible qui change (publication, modification, disponibilité, retrait, expiration, suppression) ; jamais un brouillon ni une annonce en attente. La page se recharge alors côté serveur avec les droits du visiteur : la modération et les règles d'accès s'appliquent comme au premier affichage, la liste est remplacée (aucun doublon). Sans connexion temps réel, rechargement chaque minute ; après une reconnexion ou un retour sur l'onglet, un rechargement rattrape les changements manqués. Le client temps réel (léger, diffusion seule) se charge après l'affichage de la page et une seule connexion sert toute l'application. Les cartes des résultats sont lues sans cache pour refléter le changement signalé.

## D131 — Disponibilité distincte de la publication
« Disponible », « Réservé », « Non disponible » : déclarés par l'annonceur depuis « Mes annonces », réversibles, sans effet sur le statut de publication (une annonce non disponible reste publiée). La fiche l'affiche clairement et adapte le contact (« Non disponible pour le moment : écrivez pour savoir s'il se libère ») sans l'empêcher ; filtre « Disponibles uniquement » dans les recherches.

## D132 — Trois environnements, un seul indexable
L'environnement (`APP_ENV`, sinon l'hébergeur, sinon le build) décide de l'indexation : seule la production l'est. La préproduction a sa propre base, un bandeau visible et un code d'accès ; elle n'est jamais pointée sur la base de production.

## D133 — Un accès réservé sans compte
La bêta privée et la préproduction se ferment par un code partagé (`SITE_ACCESS_CODE`) vérifié par le proxy : cookie d'empreinte (jamais le code), essais limités, supervision toujours joignable, changement de code = révocation de tous les accès. Pas de liste d'invités à gérer en base avant l'ouverture.

## D134 — Migrations en avant, compatibles avec le code en ligne
Une migration n'est jamais modifiée ni annulée automatiquement : une erreur se corrige par une migration compensatoire. Chaque migration reste compatible avec la version précédente du code (ajouter avant de retirer), ce qui rend le retour arrière du code toujours possible. Ordre : préproduction, vérifications SQL, production, puis code.

## D135 — Observer sans dépendre d'un fournisseur
Journaux JSON masqués, erreurs serveur captées par `onRequestError` et envoyées à un webhook d'équipe (une alerte par erreur et par 10 minutes), sonde de disponibilité réelle (`/api/health/ready`), indicateurs d'exploitation calculés en base (`ops_metrics`, réservé au serveur). Un service de suivi d'erreurs dédié pourra s'ajouter sans changer le code métier.

## D136 — Une fonctionnalité coupée ferme proprement
Les drapeaux qui ferment une action (publication, pages professionnelles, messagerie) sont vérifiés côté serveur, dans chaque action concernée, avec un message explicite ; la consultation reste intacte. Le temps réel a son drapeau (`live_updates`) et se replie sur un rechargement périodique.

## Dépendances (justification, §3.1)
`@supabase/supabase-js`, `@supabase/ssr` (base, session), `@supabase/realtime-js` (temps réel des listes, chargé après l'affichage ; déjà dépendance de supabase-js) · `zod` (validation) · `@anthropic-ai/sdk` (assistant IA facultatif, SDK officiel, niveau 18) · `lucide-react` (icônes, import à l'unité) · `clsx` + `tailwind-merge` (classes) · `server-only` (protection des secrets) · `leaflet` 1.9.4 (carte OpenStreetMap, choix initial du projet). Dév. : `@types/leaflet`, `vitest`, `@testing-library/*`, `jsdom`, `@vitejs/plugin-react` (tests), `@playwright/test` (navigateur), `@axe-core/playwright` 4.13.0 (audit WCAG automatique, version exacte publiée depuis plus de deux mois, niveau 25), `@vitest/coverage-v8` 5.0.5 (couverture des tests ; version imposée, identique à celle de `vitest`, niveau 27), `libpg-query` (SQL), `pg` (outil de migration par connexion directe).
