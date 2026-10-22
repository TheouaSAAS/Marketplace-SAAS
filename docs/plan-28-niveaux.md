# Plan de construction en 28 niveaux — cahier des charges

> Texte fourni par le porteur du projet (session du 2026-10-17), conservé tel quel comme référence.
> Les arbitrages ultérieurs priment : marque « Carrefour des Possibles », 4 entrées de navigation (voir `docs/decisions.md`).
> L’avancement réel est suivi dans `docs/build-state.md`.

Contruire les differentes pages 


Gouvernance des données locales :
- Chaque contenu local doit avoir un statut : verified, pending_validation, placeholder, archived ou rejected.
- Les données verified doivent enregistrer une source, une date de vérification et un responsable de validation.
- Les données pending_validation et placeholder doivent être clairement signalées dans l’administration ; elles ne doivent pas être présentées comme des faits fiables au public.
- Ne pas inventer d’adresses, prix, horaires, téléphones, limites de quartiers, disponibilités, lieux touristiques, événements, notes ou avis.
- Utiliser des données de démonstration clairement étiquetées « Exemple / à valider localement ».
- Prévoir une administration permettant de corriger, vérifier, dater, publier et archiver toute donnée locale.


Architecture cible à confirmer selon l’environnement :
- Next.js récent avec App Router et TypeScript.
- PostgreSQL/Supabase, RLS, authentification et stockage média ; pgvector si disponible.
- ORM ou client typé adapté à l’environnement.
- Stockage d’images avec URLs signées, optimisation et suppression sécurisée.
- Cartographie via Mapbox, OpenStreetMap ou équivalent compatible avec le budget et les clés disponibles.
- IA derrière des routes serveur sécurisées ; fournisseur configurable ; aucun appel IA direct depuis le navigateur avec une clé secrète.
- Tests unitaires, intégration et end-to-end.
- Observabilité, journalisation structurée et suivi des erreurs.


À la fin de chaque niveau :
1. explique brièvement ce qui a été fait ;
2. donne les fichiers créés ou modifiés ;
3. indique les migrations et variables d’environnement ;
4. exécute les tests pertinents ;
5. liste les limites, données à valider et prochaines étapes ;
6. ne prétends jamais qu’une intégration externe fonctionne sans clés ou configuration réelle.

Niveau 0 — Architecture, stack et fondations
Objectif
Initialiser une architecture solide, documentée et réaliste pour un SaaS marketplace local (un portail local qui combine annonces + guide de ville + tourisme + services de proximité)
Contexte à rappeler à Claude
Le produit est une plateforme San Pedro : annonces, guide, tourisme, carte, professionnels, IA et back-office. Les choix techniques proposés restent adaptables à l’environnement réellement disponible. Le site est pensé comme :
« Tout San Pedro dans une seule plateforme : trouver, visiter, acheter, louer, manger, se déplacer, travailler et découvrir. »
Un nouvel arrivant ne devrait pas avoir besoin de connaître San Pedro pour utiliser le site.
Il arrive sur la plateforme et peut immédiatement répondre à des questions comme :
Où dormir ?
Où manger ?
Que visiter ?
Comment me déplacer ?
Où acheter ?
Quel quartier choisir ?
Quels services sont disponibles autour de moi ?
Que faire ce week-end ?
Quels logements sont disponibles ?
Quels commerces sont ouverts ?
Quels événements sont prévus ?
Applique le cadre permanent. Construis les fondations du projet.

Inspecte l’environnement disponible, puis confirme ou adapte une stack moderne compatible avec Next.js/TypeScript, PostgreSQL/Supabase, stockage média, cartographie et API IA. Ne suppose pas qu’un service externe est déjà configuré.

Mets en place :
- une structure de dossiers claire par domaines métier ;
- une configuration TypeScript stricte ;
- gestion des variables d’environnement validées ;
- conventions de composants, routes, API, erreurs et logs ;
- docs/architecture.md ;
- docs/decisions.md ;
- docs/build-state.md ;
- docs/data-governance.md ;
- une page de statut interne non publique ;
- CI ou scripts de qualité disponibles dans l’environnement ;
- un fichier de configuration des fonctionnalités activables par feature flags.

Documente les choix retenus, alternatives écartées et conditions nécessaires pour Supabase, stockage, carte (positionnement/GPS en temps réel) et IA. Ne crée pas encore de données locales réelles.
Critères d’acceptation
•	Le projet démarre, compile et passe les contrôles de base.
•	Les variables sensibles sont validées côté serveur et absentes du navigateur.
•	L’architecture et l’état de construction sont documentés.
•	La plateforme peut fonctionner avec des services externes désactivés.
Dépendances
Aucune.
À conserver des niveaux précédents
Aucun ; ce niveau établit le socle.

Niveau 1 — Design system et identité visuelle
Objectif
Créer une identité premium, cohérente, mobile-first et accessible.
Contexte à rappeler à Claude
L’identité doit évoquer subtilement San Pedro : côte, chaleur, végétation, énergie locale. Éviter les clichés, les interfaces surchargées et les animations lourdes.

Applique le cadre permanent et conserve l’architecture du niveau 0.

Crée un design system complet pour « San Pedro — Tout San Pedro, au même endroit » :
- palette de couleurs accessible inspirée du littoral et de la végétation ;
- échelles typographiques, espacements, rayons, ombres et grilles ;
- composants : boutons, badges, cartes, champs, filtres, modales, toasts, onglets, skeletons, empty states, menus, avatars et statuts de vérification ;
- badges distincts pour verified, pending_validation et placeholder ;
- variantes mobile, tablette et desktop ;
- règles de micro-interactions courtes, respectant prefers-reduced-motion ;
- bibliothèque de composants documentée ;
- page interne de prévisualisation du design system.

Prévois les états chargement, erreur, vide, hors ligne et désactivé. Vérifie le contraste, la navigation clavier et les focus visibles.
Critères d’acceptation
•	Un design system réutilisable et documenté existe.
•	Les composants principaux sont accessibles et responsive.
•	Les données à valider sont visuellement différenciées des données vérifiées.
Dépendances
Niveau 0.
À conserver
Stack, conventions, documentation et gestion d’environnement du niveau 0.

Niveau 2 — Base de données, gouvernance et rôles
Objectif
Créer le modèle de données extensible, sécurisé et compatible avec toutes les fonctionnalités prévues.
Contexte à rappeler à Claude
La ville reste San Pedro, mais le schéma ne doit pas empêcher une extension future. Les données locales sont traçables et soumises à validation.

Applique le cadre permanent et conserve les niveaux 0 et 1.

Conçois puis implémente le schéma PostgreSQL/Supabase, les migrations, types et politiques d’accès pour :
- utilisateurs, profils, préférences, favoris et appareils ;
- organisations, profils professionnels, membres d’organisation et abonnements ;
- annonces, catégories, attributs dynamiques, médias, prix, disponibilité, localisation et états de modération ;
- immobilier, services, commerces, tourisme, lieux, quartiers, guide, événements, emploi et opportunités ;
- avis, contacts, signalements, conversations et notifications ;
- contenus source, statut de vérification, historique de modification, validation et archivage ;
- documents utilisables pour le futur RAG ;
- journal d’audit et modération.

Définis les rôles : visiteur, membre, professionnel, éditeur local, modérateur, administrateur et superadministrateur. Applique le principe du moindre privilège avec RLS ou son équivalent. Prévois une géolocalisation précise obligatoire, avec une précision publique configurable pour protéger les utilisateurs.

Crée uniquement des seeds fictifs, explicitement identifiés comme exemples à valider localement.
Critères d’acceptation
•	Les migrations s’exécutent sans erreur.
•	Les rôles et accès sont testés.
•	Chaque donnée locale possède un statut et une traçabilité de validation.
•	Les annonces et contenus peuvent être liés à une organisation ou un utilisateur.
Dépendances
Niveaux 0 et 1.
À conserver
Design system, conventions et documentation existante.

Niveau 3 — Authentification et gestion des comptes
Objectif
Permettre une inscription et une connexion simples, sécurisées et adaptées au mobile.
Contexte à rappeler à Claude
Les visiteurs peuvent explorer le site sans compte ; la publication, les favoris, le contact sécurisé et les dashboards nécessitent un compte.

Applique le cadre permanent et conserve tous les niveaux précédents.

Implémente l’authentification :
- inscription et connexion par e-mail ;
- récupération et changement de mot de passe ;
- vérification d’e-mail ;
- architecture prête pour téléphone, OAuth ou OTP, sans les prétendre actifs si non configurés ;
- création de profil et choix initial particulier/professionnel ;
- gestion de session, redirections, suppression de compte et export de données ;
- consentements nécessaires et préférences de communication ;
- protections de base contre abus, énumération de comptes et tentatives répétées.

Conçois une expérience mobile courte, claire et accessible. Un compte professionnel ne doit devenir public qu’après avoir complété son profil et respecté les règles de modération.
Critères d’acceptation
•	Un utilisateur peut s’inscrire, se connecter, récupérer son accès et se déconnecter.
•	Les routes protégées sont inaccessibles sans autorisation.
•	Les transitions particulier/professionnel sont définies et auditées.
Dépendances
Niveau 2.
À conserver
Schéma, RLS, composants et badges d’état existants.

Niveau 4 — Shell, navigation et fondations UX
Objectif
Construire le cadre global du site et sa navigation mobile-first.
Contexte à rappeler à Claude
Les entrées majeures sont : Annonces & Opportunités (Annonces, Immobilier, Services, Commerces et emploi) ; Découvrir & Sortir (Tourisme, Guide, Carte, Événements, carte interactive) ; Services & Professionnels (Services, Professionnels et entreprises, Commerces de proximité et prestataires locaux) et « 🧭 Nouveau à San Pedro ? ».

Applique le cadre permanent et conserve les niveaux précédents.

Crée le shell complet :
- en-tête responsive avec recherche, favoris, compte et bouton de publication ;
- navigation mobile basse intuitive ;
- navigation desktop structurée sans surcharge ;
- footer avec pages légales, aide, signalement et informations de vérification ;
- sélecteur de zone, initialisé sur San Pedro ;
- commande d’accès signature « 🧭 Nouveau à San Pedro ? » ;
- assistant « Demandez à San Pedro » affiché sans gêner la navigation ;
- pages 404, erreur, maintenance et absence de réseau ;
- fil d’Ariane lorsque pertinent.

Les liens peuvent mener à des écrans placeholder propres tant que les modules ne sont pas construits. Ne crée pas de contenu local non vérifié.
Critères d’acceptation
•	Navigation utilisable au clavier et sur téléphone.
•	Toutes les rubriques majeures sont accessibles.
•	Les pages incomplètes ont des états d’attente élégants et explicites.
Dépendances
Niveaux 1 et 3.
À conserver
Design system, authentification et rôles.

Niveau 5 — Accueil dynamique
Objectif
Faire de l’accueil une porte d’entrée immédiate vers la ville, les annonces et le parcours nouvel arrivant.
Contexte à rappeler à Claude
L’accroche produit est : « Tout San Pedro, au même endroit. » L’utilisateur doit pouvoir chercher, explorer ou être guidé en quelques secondes.

Applique le cadre permanent et conserve tous les niveaux précédents.

Construis la page d’accueil :
- hero premium avec recherche naturelle intelligente : « Que recherchez-vous à San Pedro ? » ;
- CTA principal « 🧭 Nouveau à San Pedro ? » ;
- accès rapides : logement, services, commerces, restaurants, tourisme, carte, emploi et événements ;
- sections dynamiques : annonces récentes, professionnels, découvrir la ville, événements à venir ;
- cartes de contenu avec badges de vérification ;
- états propres si aucun contenu validé n’existe ;
- modules de recommandation initialement déterministes et transparents ;
- animation légère des cartes et CTA, respectueuse de prefers-reduced-motion.

Utilise uniquement les seeds étiquetés exemple ou des contenus administrés. Ne publie pas de prétendus bons plans, horaires ou prix locaux non vérifiés.
Critères d’acceptation
•	L’utilisateur comprend la valeur du site en moins de quelques secondes.
•	Les principaux parcours sont accessibles avec le pouce sur mobile.
•	Aucun contenu factuel local non vérifié n’est présenté comme fiable.
Dépendances
Niveaux 2 à 4.
À conserver
Shell, navigation, statuts de données et contraintes d’accessibilité.

Niveau 6 — Parcours « 🧭 Nouveau à San Pedro ? »
Objectif
Créer l’expérience signature de guidage personnalisé des nouveaux arrivants.
Contexte à rappeler à Claude
Le parcours aide une personne qui vient travailler, étudier, visiter, s’installer ou créer une activité. Il ne donne pas de conseils financiers, légaux ou sécuritaires comme des certitudes.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le parcours « 🧭 Nouveau à San Pedro ? » :
- écran d’introduction rassurant ;
- choix ou texte libre : travailler, étudier, visiter, s’installer, entreprendre, autre ;
- préférences : durée, budget indicatif, type de logement, priorités, mobilité, centres d’intérêt ;
- progression courte, sauvegardable et reprenable ;
- plan personnalisé : logement, quartiers, commerces, services, transport, sorties, tourisme et opportunités ;
- explication transparente de la provenance des recommandations ;
- affichage de « données à vérifier » lorsque nécessaire ;
- sauvegarde dans le compte avec contrôle total de suppression.

Prépare une interface IA optionnelle, mais le parcours doit également fonctionner avec des filtres classiques et des règles déterministes.
Critères d’acceptation
•	Le parcours est utilisable sans IA.
•	Les recommandations renvoient vers de vraies fiches ou des états vides explicites.
•	L’utilisateur peut modifier ses réponses et supprimer son parcours.
Dépendances
Niveaux 2 à 5.
À conserver
Recherche, confidentialité, badges de vérification et navigation globale.

Niveau 7 — Moteur de recherche intelligente, listings et filtres
Objectif
Permettre une recherche intelligente puissante dans toutes les ressources de la plateforme.
Contexte à rappeler à Claude
La recherche intelligente doit fonctionner par mots-clés et progressivement accepter le langage naturel : « studio à louer près de moi », « électricien », « activité ce week-end ». 

Applique le cadre permanent et conserve les niveaux précédents.

Implémente un moteur de recherche transversal :
- recherche textuelle d’annonces, lieux, professionnels, commerces, événements et opportunités ;
- résultats par type avec onglets et pagination ;
- filtres facettés : catégorie, prix, quartier, distance, date, disponibilité, statut professionnel, type de contenu ;
- tri pertinent, récent, prix et proximité ;
- filtres propres à l’URL et partageables ;
- sauvegarde de recherche pour les utilisateurs connectés ;
- états sans résultat proposant d’élargir les critères ;
- préparation d’un parseur de langage naturel qui retourne des filtres structurés, sans inventer de critères ;
- suivi analytique respectueux de la vie privée.

Les résultats doivent toujours préciser leur type et la fraîcheur des données. La proximité est désactivée si la position n’est pas autorisée.
Critères d’acceptation
•	Les filtres, pagination et URL sont cohérents.
•	Une requête ne mélange pas confusément annonces et contenus guide.
•	La recherche fonctionne avec données fictives et sans IA.
Dépendances
Niveaux 2, 4 et 5.
À conserver
Schéma de données, shell, états de vérification et UX mobile.

Niveau 8 — Détail d’annonce, favoris et contact
Objectif
Créer une fiche d’annonce fiable, conversion-friendly et sûre.
Contexte à rappeler à Claude
Une annonce peut concerner un bien, un objet, un service ou une opportunité. Le contact doit protéger les coordonnées et limiter le spam.

Applique le cadre permanent et conserve les niveaux précédents.

Construis une page de détail d’annonce :
- galerie média optimisée ;
- titre, prix, catégorie, attributs, localisation avec précision contrôlée, date et disponibilité ;
- statut de vérification, profil vendeur et autres annonces du vendeur ;
- CTA favoris, partager, aimer, commenter, contacter et signaler ;
- messagerie interne (une messagerie qui va permettre a l’utilisateur/visiter de discuter en temps réel avec le vendeur/l’annonceur ou autres) et demande de contact sécurisé ;
- intégration WhatsApp/téléphone uniquement avec consentement du vendeur et protection anti-abus ;
- annonces similaires fondées sur des règles explicables ;
- compteur de vues respectueux de la vie privée ;
- gestion des annonces expirées, archivées, supprimées ou en attente ;
- données structurées SEO adaptées.
- emplacement avec précision sur la carte interactive sur la page  

Ne révèle jamais une localisation précise ou un téléphone si les paramètres de confidentialité ne l’autorisent pas.
Critères d’acceptation
•	Le détail est responsive, performant et accessible.
•	Favoris, signalement et contact respectent les droits d’accès.
•	Une annonce inactive ne peut pas être sollicitée normalement.
Dépendances
Niveaux 2, 3 et 7.
À conserver
Recherche intelligente, badges, sécurité et modèle de données.

Niveau 9 — Immobilier
Objectif
Créer une expérience spécialisée pour louer, vendre ou rechercher un logement et des locaux.
Contexte à rappeler à Claude
L’immobilier doit proposer des filtres précis, sans promettre de disponibilité ni présenter un quartier comme meilleur sans données vérifiées.

Applique le cadre permanent et conserve tous les niveaux précédents.

Construis le domaine Immobilier :
- routes location, vente, temporaire et professionnel ;
- attributs : type de bien, pièces, surface, meublé, budget, disponibilité, quartier, équipements et précision de localisation ;
- recherche « je cherche un logement » avec filtres et langage naturel préparé ;
- cartes de biens et comparaison ;
- fiche adaptée à l’immobilier, incluant contact, règles de sécurité et signalement ;
- recherche par budget, sans conseil financier ;
- page de conseils éditoriaux génériques, administrables et sourcés ;
- gestion des annonces expirées et de la date de dernière confirmation.

Les contours de quartiers, prix et disponibilités restent administrables et soumis aux statuts de vérification.
Critères d’acceptation
•	Les filtres immobiliers sont adaptés aux différents types de biens.
•	Les annonces expirées ou non confirmées sont clairement signalées.
•	La navigation vers le contact et la carte respecte la confidentialité.
Dépendances
Niveaux 7 et 8.
À conserver
Moteur de recherche, détails, modération et gouvernance.

Niveau 10 — Services de proximité
Objectif
Permettre de trouver rapidement le bon artisan, prestataire ou service professionnel.
Contexte à rappeler à Claude
Exemples : plomberie, électricité, climatisation, mécanique, coiffure, nettoyage, informatique, photographie, déménagement, services B2C et services B2B.

Applique le cadre permanent et conserve tous les niveaux précédents.

Construis le domaine Services :
- taxonomie administrable de métiers et spécialités ;
- répertoire de professionnels et annonces de service ;
- filtres : métier, quartier, distance, disponibilité déclarée, vérification et mode de contact ;
- recherche naturelle préparée : « ma climatisation ne fonctionne plus » ;
- fiches de service avec prestations, zone desservie, portfolio, horaires uniquement si vérifiés, contact et signalement ;
- demande de devis structurée avec accord explicite avant transmission ;
- affichage transparent des critères de mise en avant.

Prévois que les informations de disponibilité restent déclaratives et datées ; ne présente pas un professionnel comme disponible en temps réel sans mécanisme réel.
Critères d’acceptation
•	L’utilisateur peut trouver, filtrer et contacter un prestataire.
•	Une demande de devis ne divulgue pas de coordonnées sans consentement.
•	Les catégories peuvent être gérées depuis l’administration.
Dépendances
Niveaux 2, 7, 8 et 19 à venir.
À conserver
Fiches, contact sécurisé, géolocalisation et badges.

Niveau 11 — Commerces et annuaire local
Objectif
Créer des vitrines locales vivantes pour commerces, restaurants et boutiques avec messagerie intégrée.
Contexte à rappeler à Claude
Les commerces ne sont pas seulement des annonces : ils ont une page professionnelle, des catégories, produits ou services, une localisation précise et des horaires potentiellement vérifiés.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le domaine Commerces :
- annuaire de commerces avec catégories administrables ;
- fiches vitrines : description, galerie, services, produits, quartier, contact, itinéraire, horaires et statut de vérification ;
- vues spécialisées restaurants, alimentation, boutiques, quincailleries, auto, technologie et autres catégories configurables ;
- filtres : type, budget indicatif, ambiance, services, proximité et statut vérifié ;
- gestion des horaires avec date de vérification et état « à confirmer » ;
- mise en avant transparente des profils sponsorisés ;
- CTA favoris, contact, signalement, partage et aime.

Aucun commerce, horaire ou produit réel ne doit être inventé. Les exemples sont identifiés comme démonstrations.
Critères d’acceptation
•	Les commerces sont consultables et filtrables sur mobile.
•	Les horaires sont sourcés ou affichés comme non confirmés.
•	La vitrine peut être revendiquée par un professionnel selon un processus de validation.
Dépendances
Niveaux 2, 7 et 8.
À conserver
Architecture de profils, recherche, badges et confidentialité.

Niveau 12 — Tourisme et itinéraires
Objectif
Faire du site un guide de découverte fiable pour San Pedro et ses environs.
Contexte à rappeler à Claude
L’IA et les itinéraires doivent s’appuyer uniquement sur les contenus administrés, datés et vérifiés. Ne pas inventer d’horaires, transports, conditions d’accès ou activités.

Applique le cadre permanent et conserve tous les niveaux précédents.

Construis le domaine Tourisme :
- destinations, lieux, activités, hébergements, restaurants et opérateurs ;
- fiches riches avec description, médias, carte, conditions d’accès, contacts, sources, date de vérification et avertissements ;
- pages « Où dormir ? », « Où manger ? », « Que découvrir ? » et « Sortir » ;
- filtres : thème, public, durée, budget indicatif, accessibilité, distance et statut de vérification ;
- créateur d’itinéraire fondé sur données locales disponibles, sans invention ;
- CTA favoris, partage, contact avec opérateur et signalement ;
- tout contenu local soumis à la gouvernance des données.

Quand une donnée manque, affiche une information honnête : « information à confirmer localement ».
Critères d’acceptation
•	Les lieux et activités possèdent source, statut et date de vérification.
•	Les itinéraires ne suggèrent que des éléments réellement présents dans la base.
•	Les pages restent utiles même sans données vérifiées.
Dépendances
Niveaux 2, 7, 8 et 11.
À conserver
Séparation entre contenu éditorial, annonces et données vérifiées.

Niveau 13 — Guide pratique de la ville
Objectif
Créer un guide administrable pour vivre, se déplacer et s’orienter à San Pedro.
Contexte à rappeler à Claude
Le guide répond à des besoins quotidiens : logement, courses, mobilité, santé, banques, télécommunications, démarches, éducation, loisirs et vie locale.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le Guide pratique :
- catégories administrables : s’installer, se loger, se déplacer, services essentiels, faire ses courses, santé, banques, télécommunications, éducation, tourisme et entreprendre ;
- articles avec auteur, source, date de vérification, statut de publication et versioning ;
- sommaire, recherche, lecture mobile, contenus liés et appels vers les ressources du site ;
- composants d’avertissement et de fraîcheur des informations ;
- mécanisme de suggestion de correction par les utilisateurs ;
- liens vers les pages de catégories et la carte lorsque les données correspondantes existent ;
- préparation pour les réponses RAG du futur assistant.

Ne présente pas un contenu d’orientation générale comme un conseil légal, médical, administratif ou financier personnalisé.
Critères d’acceptation
•	Les articles sont versionnés et modérables.
•	Les contenus non vérifiés ne sont pas publiés comme certitudes.
•	Le guide se connecte aux recherches et ressources réelles du site.
Dépendances
Niveaux 2, 7, 11 et 12.
À conserver
Gouvernance, statuts, moteur de recherche et design éditorial.

Niveau 14 — Quartiers
Objectif
Créer des fiches de quartiers utiles et neutres, sans figer de fausses frontières.
Contexte à rappeler à Claude
Les noms, descriptions, contours et caractéristiques des quartiers exigent validation locale. La plateforme doit pouvoir les corriger facilement.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le domaine Quartiers :
- modèle de quartier avec noms alternatifs, description neutre, géométrie facultative, statut de validation, sources, responsable et date de contrôle ;
- fiches quartier présentant uniquement les ressources réellement enregistrées : annonces, commerces, services, lieux et événements ;
- onglets : à découvrir, logement, services, commerces, tourisme et carte ;
- administration des limites géographiques avec brouillon, validation et historique ;
- filtre quartier dans les autres domaines ;
- avertissement clair lorsqu’un quartier n’a pas de périmètre ou de contenu validé.

Ne qualifie pas un quartier de sûr, meilleur, riche, dangereux, calme ou pratique sans critères administrés, sourcés et contrôlés.
Critères d’acceptation
•	Les quartiers peuvent exister sans carte exacte.
•	Les contenus associés sont filtrés par relations réelles, pas inventés.
•	Toute modification de périmètre est auditable.
Dépendances
Niveaux 2, 7, 9 à 13.
À conserver
Gouvernance des contenus et règles de neutralité éditoriale.

Niveau 15 — Carte interactive
Objectif
Construire le cœur géographique de la plateforme : explorer San Pedro par catégories et proximité.
Contexte à rappeler à Claude
La carte doit afficher les éléments administrés : annonces, professionnels, commerces, tourisme, événements et services. La géolocalisation utilisateur est toujours facultative.

Applique le cadre permanent et conserve les niveaux précédents.

Construis la carte interactive :
- fournisseur de cartes configurable ; fallback accessible si aucune clé n’est disponible ;
- couches activables : immobilier, services, commerces, tourisme, événements, emploi et points guide ;
- regroupement de marqueurs, panneau de résultats, filtres et fiche rapide ;
- recherche par zone, quartier et proximité ;
- demande de géolocalisation explicite, sans stockage de position précise par défaut ;
- précision publique configurable pour les annonces sensibles ;
- itinéraire via lien vers une application cartographique, sans prétendre fournir une navigation intégrée ;
- performance mobile : chargement différé, clustering et limitation des requêtes.

La carte ne doit afficher que des coordonnées autorisées et la source de chaque élément doit rester traçable.
Critères d’acceptation
•	La carte reste fonctionnelle ou propose un fallback sans clé externe.
•	Les résultats carte et liste restent synchronisés.
•	Les données privées ne sont jamais exposées.
Dépendances
Niveaux 2, 7, 9 à 14.
À conserver
Filtres URL, confidentialité, statuts et composants de fiches.


Niveau 16 — Événements
Objectif
Permettre de découvrir et publier ce qui se passe à San Pedro.
Contexte à rappeler à Claude
Les événements sont sensibles à la date. Ils doivent indiquer leur source, organisateur, dernière vérification et statut de publication.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le domaine Événements :
- calendrier, liste et vue carte ;
- catégories : culture, sport, formation, professionnel, tourisme, communauté et autres administrables ;
- filtres aujourd’hui, semaine, week-end, mois, gratuit/payant et quartier ;
- fiche événement : date, heure, lieu, organisateur, contact, prix éventuel, sources, dernière vérification et signalement ;
- gestion des annulations, reports, archivage automatique et rappels ;
- publication par organisateur soumise à modération ;
- ajout aux favoris et aux notifications.
- intègre une messagerie afin de discuter avec les promoteurs / annonceurs.

Ne montre pas un événement passé comme à venir et ne crée aucune programmation fictive.
Critères d’acceptation
•	Les événements sont correctement triés dans le temps.
•	Un report ou une annulation apparaît clairement.
•	La publication est soumise aux droits et à la modération.
Dépendances
Niveaux 2, 7, 8 et 15.
À conserver
Gouvernance, profils, carte, alertes et logique de signalement.


Niveau 17 — Emploi et opportunités
Objectif
Créer un espace crédible pour offres d’emploi, missions, stages, formation et opportunités économiques.
Contexte à rappeler à Claude
La plateforme doit permettre aux employeurs et candidats de publier ou consulter sans exposer inutilement leurs données personnelles.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le domaine Emploi et opportunités :
- offres d’emploi, missions, stages, formations, appels à prestataires et annonces de compétences ;
- filtres contrat, domaine, expérience, date, lieu, télétravail éventuel et type d’organisation ;
- fiches d’offre avec entreprise, date limite, modalités de candidature, statut de vérification et signalement ;
- profils candidats avec visibilité et coordonnées contrôlables ;
- candidature interne ou lien externe sécurisé ;
- expiration automatique et gestion des offres clôturées ;
- aide IA future pour structurer une offre, sans décision automatisée sur les candidats.
- fonctionnalité à l’aide de l’IA pour publier des offres postées sur LinkedIn.
 

Interdis les formulations discriminatoires, trompeuses ou frauduleuses via règles de publication et modération.
Critères d’acceptation
•	Une offre expirée ou close n’accepte plus de candidature.
•	Les données de candidat sont privées par défaut.
•	Les employeurs et offres sont modérables.
Dépendances
Niveaux 2, 3, 7, 8 et 19.
À conserver
Profils, droits, modération, notifications et search UX.


Niveau 18 — Publication d’annonce avec IA
Objectif
Réduire la difficulté de publication tout en laissant toujours la décision finale à l’utilisateur.
Contexte à rappeler à Claude
L’IA peut structurer un texte, analyser une photo ou extraire un PDF, mais elle ne doit ni inventer d’informations ni publier automatiquement.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le parcours « Publier une annonce » :
- choix de catégorie ou saisie libre ;
- saisie guidée et formulaires spécifiques selon la catégorie ;
- import texte, photo et PDF, soumis aux limites et contrôles de sécurité ;
- couche IA optionnelle : extraction de champs, suggestion de catégorie, titre, mots-clés, description structurée, informations manquantes et détection de photos faibles ou doublons ;
- affichage clair de chaque suggestion avec source, niveau de confiance et possibilité d’annuler ;
- prévisualisation avant publication ;
- brouillon, autosave, validation, soumission à modération et suivi du statut ;
- règles anti-fraude et détection de contenu interdit.

Aucun champ généré par IA ne doit être publié sans validation explicite de l’utilisateur. Ne traite pas un PDF ou une image comme une source fiable sans confirmation humaine.
Critères d’acceptation
•	Un utilisateur peut publier entièrement sans IA.
•	Toute suggestion IA est modifiable, rejetable et traçable.
•	Les brouillons et médias sont protégés par les droits d’accès.
Dépendances
Niveaux 2, 3, 8 et 26 à compléter.
À conserver
Droits, audit, modération, design system et gouvernance.




Niveau 19 — Profils professionnels
Objectif
Créer des pages professionnelles convaincantes pour artisans, commerces, agences et opérateurs.
Contexte à rappeler à Claude
Un professionnel peut posséder une vitrine, publier plusieurs annonces, recevoir des demandes et potentiellement souscrire une offre premium transparente.

Applique le cadre permanent et conserve les niveaux précédents.

Construis les profils professionnels :
- création et revendication de profil ;
- identité, présentation, services, catégories, zones desservies, médias, horaires, contacts, liens et annonces associées ;
- gestion d’équipe et rôles au sein d’une organisation ;
- badges : profil complété, vérifié, en cours de validation, sponsorisé ;
- avis et réponses, avec modération et règles anti-manipulation ;
- génération IA optionnelle de présentation et FAQ, soumise à validation ;
- architecture d’offres premium et mise en avant, sans paiement réel tant que celui-ci n’est pas configuré.

Distingue toujours « vérifié » d’un simple profil complété ou sponsorisé.
Critères d’acceptation
•	Un professionnel peut gérer sa page et ses collaborateurs selon leurs droits.
•	Les badges ont une définition claire et non trompeuse.
•	Les profils s’intègrent aux résultats de recherche et aux cartes.
Dépendances
Niveaux 2, 3, 8, 10, 11 et 17.
À conserver
Rôles, modération, publication, confidentialité et design.

Niveau 20 — Dashboard utilisateur
Objectif
Donner aux particuliers le contrôle de leurs annonces, favoris, messages, recherches et données.
Contexte à rappeler à Claude
Le dashboard doit être simple sur mobile, sécurisé et très lisible.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le dashboard utilisateur :
- vue d’ensemble ;
- mes annonces : brouillons, en attente, publiées, expirées, archivées et refusées ;
- favoris, recherches sauvegardées et parcours « Nouveau à San Pedro » ;
- messages, demandes de contact et signalements ;
- alertes et préférences de notifications ;
- profil, confidentialité, sécurité, consentements, export et suppression de données ;
- analytics simples : vues et contacts, avec explication de leurs limites.

Chaque action sensible doit demander confirmation et conserver un historique pertinent. L’interface doit fonctionner sur petit écran sans tableau illisible.
Critères d’acceptation
•	Un utilisateur ne voit que ses propres données.
•	Les états d’annonce sont compréhensibles et actionnables.
•	Les préférences de confidentialité sont appliquées dans le site public.
Dépendances
Niveaux 3, 8, 18 et 24 à compléter.
À conserver
Authentification, accès, audit et composants existants.

Niveau 21 — Dashboard professionnel
Objectif
Permettre aux professionnels de piloter leur présence locale et leurs interactions.
Contexte à rappeler à Claude
Le dashboard professionnel gère une organisation, des annonces, une vitrine, des membres, des demandes, des statistiques et une éventuelle visibilité premium.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le dashboard professionnel :
- aperçu de l’organisation et de la complétude du profil ;
- gestion des annonces, services, produits, événements et offres d’emploi ;
- boîte de réception et demandes de devis ;
- gestion des collaborateurs avec permissions ;
- statistiques : vues, favoris, contacts et performances, avec définitions explicites ;
- demandes de vérification, historique de modération et corrections demandées ;
- préparation des options premium, sans promesse de paiement actif si non configuré.

Assure une séparation stricte entre organisations, collaborateurs et données de chaque client professionnel.
Critères d’acceptation
•	Les rôles organisationnels sont respectés.
•	Les professionnels comprennent les actions nécessaires à la publication.
•	Les statistiques ne divulguent aucune donnée personnelle d’un visiteur.
Dépendances
Niveaux 3, 18, 19 et 20.
À conserver
RLS, modération, gestion des profils et dashboards utilisateur.

Niveau 22 — Administration et back-office
Objectif
Donner à l’équipe locale les outils nécessaires pour valider, corriger, modérer et administrer toute la plateforme.
Contexte à rappeler à Claude
L’administration doit être le garant de la qualité des données San Pedro, pas seulement une gestion d’utilisateurs.

Applique le cadre permanent et conserve les niveaux précédents.

Construis un back-office sécurisé :
- tableau de bord de modération ;
- files d’attente pour annonces, professionnels, événements, avis, signalements et contenus IA ;
- gestion utilisateurs, organisations, rôles et sanctions ;
- administration des catégories, quartiers, lieux, contenus guide, sources et statuts de vérification ;
- workflow brouillon → revue → validé/refusé → publié → archivé ;
- correction des données, fusion de doublons et historique complet ;
- gestion des contenus mis en avant et abonnements ;
- tableau de bord qualité : contenus expirés, sans source, à revalider, signalés ;
- assistant admin IA uniquement comme outil de suggestion, jamais comme décision autonome.

Journalise toute action d’administration sensible avec auteur, date, raison et avant/après.
Critères d’acceptation
•	Les modérateurs ne possèdent pas les droits superadministrateur.
•	Tout changement éditorial ou de vérification est auditable.
•	Les contenus douteux peuvent être suspendus rapidement.
Dépendances
Tous les niveaux métier précédents.
À conserver
Droits, statuts, historique, RLS et workflow de publication.

Niveau 23 — Couche IA, RAG et données locales
Objectif
Intégrer l’IA de manière utile, contrôlée, explicable et fondée sur des données administrées.
Contexte à rappeler à Claude
Usages attendus : recherche naturelle, assistant nouvel arrivant, recommandations, structuration d’annonces, extraction texte/photo/PDF, géolocalisation précise, modération assistée et assistant admin.

Applique le cadre permanent et conserve les niveaux précédents.

Conçois et implémente une couche IA modulaire :
- fournisseur et modèle configurables côté serveur ;
- recherche naturelle convertissant une demande en filtres structurés ;
- assistant « Demandez à San Pedro » avec RAG sur contenus validés ;
- assistant « Nouveau à San Pedro » utilisant préférences, ressources et données vérifiées ;
- recommandations explicables ;
- copilote de publication ;
- extraction depuis texte, image ou PDF avec validation humaine ;
- aide de modération et assistant admin sous contrôle humain ;
- recherche géolocalisée utilisant seulement position autorisée et données accessibles.

Implémente :
- récupération de sources, citations internes et date de fraîcheur ;
- filtrage strict des contenus non vérifiés selon le contexte ;
- refus honnête lorsque les données manquent ;
- protection contre prompt injection dans les contenus importés ;
- quotas, limites de coût, logs minimisés et mécanisme de désactivation ;
- tests de non-hallucination sur données absentes.

L’IA doit dire « je ne dispose pas d’information vérifiée » plutôt que d’inventer.
Critères d’acceptation
•	Chaque réponse RAG affiche les sources internes ou indique l’absence de source.
•	Aucun outil IA ne publie ou sanctionne automatiquement.
•	Le site reste pleinement utilisable si l’IA est désactivée.
Dépendances
Niveaux 2, 6, 7, 13, 18 et 22.
À conserver
Données vérifiées, confidentialité, workflows et interfaces sans IA.


Niveau 24 — Notifications et réengagement
Objectif
Informer sans spam : réponses, favoris, événements, modération, expiration et suivi des recherches.
Contexte à rappeler à Claude
Les notifications peuvent être in-app, e-mail et plus tard push ou SMS selon configuration et consentement.

Applique le cadre permanent et conserve les niveaux précédents.

Construis le système de notifications :
- centre de notifications in-app ;
- préférences détaillées par canal ;
- e-mails transactionnels : vérification, message, contact, modération, expiration et réinitialisation ;
- alertes de recherches sauvegardées ;
- rappels d’événements et d’annonces à confirmer ;
- gestion des désinscriptions et du consentement ;
- file d’envoi, idempotence, journalisation et gestion des échecs ;
- abstraction pour push/SMS, sans les activer sans fournisseur configuré.

Les alertes liées à des contenus non vérifiés doivent éviter toute formulation qui les présente comme certains.
Critères d’acceptation
•	L’utilisateur peut gérer ses préférences.
•	Les notifications ne sont pas dupliquées.
•	Les e-mails fonctionnent avec un fournisseur configuré ou sont proprement simulés en développement.
Dépendances
Niveaux 3, 16, 18, 20 à 22.
À conserver
Consentement, sécurité, profils et audit.


Niveau 25 — SEO, performance et accessibilité
Objectif
Rendre la plateforme découvrable, rapide et inclusive, particulièrement sur mobile et réseau limité.
Contexte à rappeler à Claude
Le référencement doit promouvoir les pages publiques fiables, sans indexer du contenu privé, mince, expiré ou non vérifié de manière trompeuse.

Applique le cadre permanent et conserve tous les niveaux précédents.

Réalise le chantier SEO, performance et accessibilité :
- métadonnées, Open Graph, sitemap, robots et canonical ;
- données structurées adaptées aux annonces, organisations, événements et lieux, uniquement lorsque les données sont fiables ;
- stratégie noindex pour dashboards, brouillons, messages et contenus faibles ;
- rendu performant, images optimisées, cache, chargement différé de carte et réduction JavaScript ;
- budget de performance et mesure Core Web Vitals ;
- audit WCAG 2.2 AA : clavier, lecteur d’écran, contraste, labels, focus, erreurs et mouvement réduit ;
- pages légères pour réseau lent ;
- politique de contenu dupliqué, pagination et URL filtrées.

Documente les résultats mesurés et les points dépendant du déploiement réel.
Critères d’acceptation
•	Les pages publiques majeures ont métadonnées et partage social.
•	Les interfaces principales passent les contrôles d’accessibilité pertinents.
•	La carte et les médias ne dégradent pas excessivement le chargement initial.
Dépendances
Tous les domaines publics construits.
À conserver
Confidentialité, vérification des données, shell et composants accessibles.




Niveau 26 — Sécurité et anti-fraude
Objectif
Protéger utilisateurs, contenus, médias, paiements futurs et administration contre fraude, abus et fuite de données.
Contexte à rappeler à Claude
Les petites annonces exposent aux escroqueries, spam, usurpation, contenus interdits et exposition excessive des coordonnées.

Applique le cadre permanent et conserve tous les niveaux précédents.

Implémente une stratégie de sécurité et anti-fraude :
- validation stricte des entrées, limites de taille et type de fichiers ;
- antivirus ou analyse asynchrone des médias si disponible ;
- URLs signées, contrôle d’accès et suppression sécurisée des fichiers ;
- rate limiting, CAPTCHA ou challenge adaptatif, prévention spam et abus de messages ;
- règles de détection de doublons, prix incohérents, liens suspects, coordonnées répétées et comportement anormal ;
- signalement, suspension, blocage et appels ;
- protections CSRF, XSS, injection, SSRF, élévation de privilèges et fuite de secrets ;
- journal d’audit, alertes sécurité et procédure de réponse à incident ;
- avertissements de sécurité pour acheteurs et vendeurs,
- insérer un contrat d’accord et d’engagement rédigé entre l’annonceur/le vendeur et le visiteur/le particulier afin d’éviter les anarques.

Les scores anti-fraude sont des aides à la revue humaine : ils ne doivent pas déclencher de sanction définitive sans possibilité de contrôle.
Critères d’acceptation
•	Les contrôles d’accès sont testés sur les ressources critiques.
•	Les uploads et messages sont soumis à des limites et validations.
•	Les admins disposent d’outils de revue et d’un audit fiable.
Dépendances
Niveaux 2, 3, 8, 18 et 22.
À conserver
RLS, modération, confidentialité et UX de signalement.
Niveau 27 — Tests et assurance qualité
Objectif
Vérifier les parcours critiques, les règles métier, la sécurité et l’accessibilité avant lancement.
Contexte à rappeler à Claude
Les tests doivent couvrir les fonctionnalités avec et sans IA, les rôles, la modération, les statuts de vérification et l’expérience mobile.

Applique le cadre permanent et conserve tout le projet.

Mets en place et complète la stratégie de tests :
- tests unitaires des règles métier, filtres, statuts, droits et transformation IA ;
- tests d’intégration base de données, RLS, API, upload, modération et notifications ;
- tests end-to-end mobile et desktop pour inscription, recherche, favoris, contact, publication, modération et parcours « Nouveau à San Pedro » ;
- tests d’accessibilité automatisés et revues manuelles ciblées ;
- tests de sécurité essentiels ;
- tests de non-hallucination : absence de source, contenu non vérifié, demande ambiguë et tentative de prompt injection ;
- jeux de données test séparés des seeds de démonstration ;
- rapport clair de couverture et risques restants.

Corrige les défauts critiques détectés sans régression, puis mets à jour la checklist de lancement.
Critères d’acceptation
•	Les parcours critiques sont couverts par des tests reproductibles.
•	Les règles d’accès et modération sont testées.
•	Les limites IA et données locales sont explicitement testées.
Dépendances
Tous les niveaux précédents.
À conserver
Architecture, documentation et décisions produit.


Niveau 28 — Déploiement, observabilité et lancement
Objectif
Préparer une mise en production fiable, progressive et mesurable.
Contexte à rappeler à Claude
Ne déployez pas comme réel un service dont les clés, domaines, DNS, comptes ou validations ne sont pas disponibles. Prévoir un environnement de préproduction.
Applique le cadre permanent et conserve tout le projet.

Prépare le déploiement :
- environnements développement, préproduction et production ;
- configuration sécurisée des variables ;
- migrations contrôlées, sauvegardes, restauration et plan de rollback ;
- CI/CD avec contrôles qualité avant déploiement ;
- domaine, HTTPS, en-têtes de sécurité et politiques d’accès ;
- observabilité : logs structurés, erreurs, métriques, performance et alertes ;
- suivi des coûts base, stockage, carte et IA ;
- feature flags pour IA, paiement, géolocalisation, publication professionnelle et notifications ;
- plan de lancement progressif : bêta privée, collecte de retours, validation locale des données puis ouverture ;
- runbook opérationnel et checklist incident.

Distingue clairement ce qui est prêt dans le code de ce qui nécessite une action humaine ou une configuration de fournisseur.
Critères d’acceptation
•	La préproduction peut être déployée de façon reproductible.
•	Un rollback et une restauration sont documentés.
•	Les services externes peuvent être désactivés sans rendre le site inutilisable.
Dépendances
Tous les niveaux 0 à 27.
À conserver
Toutes les protections, tests, données administrées et feature flags.


Prompt maître — Audit global et checklist de finalisation
Tu es l’architecte principal et auditeur qualité de « San Pedro — Tout San Pedro, au même endroit ».
Inspecte l’intégralité du projet existant et réalise un audit global, sans réécrire inutilement ce qui fonctionne. Vérifie la cohérence entre le code, les migrations, les politiques d’accès, la documentation et les fonctionnalités prévues :
1. Architecture et qualité TypeScript.
2. Modèle de données, RLS, rôles, journal d’audit et administration.
3. Authentification, confidentialité, gestion des médias et sécurité.
4. Navigation, design system, responsive mobile-first et accessibilité.
5. Accueil, recherche, listings, détails, favoris, contact et publication.
6. Immobilier, services, commerces, tourisme, guide, quartiers, carte, événements et emploi.
7. Parcours « 🧭 Nouveau à San Pedro ? ».
8. Profils professionnels et dashboards.
9. IA : recherche naturelle, RAG, recommandations, extraction, modération et assistant admin.
10. Notifications, SEO, performance, tests, observabilité et déploiement.
11. Protection contre l’invention de données locales : sources, statut verified/pending_validation/placeholder, dates et outils de correction.
12. Risques de fraude, abus, fuite de données et contenu dangereux.

Rends un rapport priorisé avec :
- les éléments conformes ;
- les défauts bloquants, classés P0, P1, P2 et P3 ;
- les fichiers concernés ;
- la correction recommandée et le risque si elle n’est pas faite ;
- les tests manquants ;
- les données locales qui doivent être validées humainement avant publication ;
- une checklist finale de lancement, distinguant « prêt », « à configurer », « à valider localement » et « à reporter ».

Ensuite, corrige automatiquement les problèmes P0 et P1 qui peuvent l’être sans décision métier, sans modifier les données locales ni désactiver les protections existantes. Exécute les tests pertinents et mets à jour docs/build-state.md, docs/decisions.md, docs/data-governance.md et la checklist de lancement.
