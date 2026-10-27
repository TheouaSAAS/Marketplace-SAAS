# Sécurité et anti-fraude

État au **niveau 26** (24/10/2026). Les règles d'accès sont garanties par la base (RLS, fonctions à droits vérifiés) ; l'interface ne fait que masquer ce qui n'est pas permis. Matrice d'accès vérifiée par `supabase/tests/level26_security.sql` et les tests des niveaux précédents.

## Connexion, inscription et administration

- Mots de passe : jamais stockés ni journalisés par la plateforme (Supabase Auth) ; 10 caractères, une lettre et un chiffre ; affichage masquable.
- Validation serveur (Zod) de chaque formulaire ; destinations de retour limitées aux chemins internes (`safeRedirectPath`), celles de l'administration à `/admin`.
- Limitation : connexion 10 essais / 15 min, administration 5 / 15 min, second facteur 10 / 15 min, renvoi de confirmation 3 / heure (par IP et par adresse visée).
- Anti-énumération : inscription, mot de passe oublié et renvoi répondent pareil que l'adresse existe ou non ; la connexion ne précise pas ce qui est faux (l'adresse non confirmée n'est signalée qu'avec le bon mot de passe).
- Confirmation de l'adresse obligatoire (`mailer_autoconfirm` désactivé) : sans elle, aucune connexion ; liens à usage unique, valables une heure.
- Sessions : cookies gérés par Supabase SSR (jetons signés vérifiés côté serveur, rotation des jetons de rafraîchissement) ; la déconnexion révoque la session de l'appareil.
- Administration : connexion dédiée `/admin/connexion`, second facteur TOTP exigé par la base (D138), journal des accès (D139), réinitialisation d'un facteur perdu par un superadministrateur avec raison journalisée ; un facteur actif ne se remplace pas avec le seul mot de passe.
- Aucun rôle par l'inscription publique : métadonnées ignorées par `handle_new_user`, rôle protégé par `protect_profile_privileges` (vérifié par `supabase/tests/auth_access.sql`).

## Cabine en ligne

Voir `docs/cabine.md` : aucun PIN demandé ni stocké, clés côté serveur, récapitulatif signé, idempotence, limites par IP et par destinataire, réussite seulement confirmée par un prestataire réel, numéros masqués et empreintes, notifications signées, opérations réservées à leur auteur et aux administrateurs, rapprochements journalisés. Mode démonstration tant qu'aucun prestataire agréé n'est intégré.

## Accès réservé et environnements (niveau 28)

- Préproduction et bêta privée : `SITE_ACCESS_CODE` (12 caractères minimum). Le proxy sert `/acces` (401, non indexée) sans cookie valide ; le cookie (`HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS, 30 jours) contient une empreinte SHA-256 du code ; 10 essais par quart d'heure et par adresse. Changer le code révoque tous les accès.
- Hors production : `robots.txt` fermé et `X-Robots-Tag: noindex, nofollow` sur toutes les réponses.
- `npm run env:check` refuse les réglages de test en production et signale les accès d'administration de la base laissés dans l'application.
- Alertes d'erreurs : seul le chemin (sans paramètres), la méthode et l'empreinte de l'erreur quittent le serveur vers `ALERT_WEBHOOK_URL`.

## Entrées et fichiers

- Validation stricte côté serveur (Zod) de chaque action ; longueurs bornées en base (`check`).
- Photos : déposées dans le stockage **privé** sous le dossier de leur auteur, publiques seulement à la publication. À l'enregistrement, le serveur relit le fichier réellement déposé : signature JPEG, PNG ou WebP (jamais le type annoncé par le navigateur), taille (5 Mo), empreinte SHA-256 comparée à celle calculée par le navigateur ; un fichier non conforme est supprimé. Les doublons d'images entre comptes sont signalés à la modération.
- Pas d'antivirus branché : seuls des formats d'image décodables sont acceptés, aucun document exécutable n'est servi. Un service d'analyse pourra s'insérer au même endroit (vérification avant enregistrement).
- Suppression : brouillon supprimé avec ses photos ; retrait d'une photo, fichier d'abord puis fiche.

## Abus et robots

- Limitation de débit en base (empreintes HMAC, aucune adresse IP en clair) : inscription, connexion, réinitialisation, brouillons, IA, questions, recherches IA ; débit des messages, signalements, avis, recours limités par la base.
- Défi anti-robot sans service tiers sur l'inscription et le mot de passe oublié : champ piège invisible (réponse factice au robot, rien n'est envoyé) et délai minimal de saisie (2,5 s, `BOT_TRAP_MIN_MS`, abaissé à 0 seulement pour les tests ; `/interne/statut` le signale sinon).
- Blocage d'un membre : il ne peut plus écrire à celui qui l'a bloqué (règle en base), sans en être averti.

## Fraude

Score d'**aide à la revue** (jamais une sanction automatique) : photo identique à celle d'un autre compte (3), paiement d'avance ou transfert demandé (3), même numéro utilisé par plusieurs autres comptes (3), lien raccourci ou messagerie externe (2), prix inférieur au quart du médian de la catégorie (2) ou supérieur à cinq fois (1), compte récent avec 3 annonces en 24 h (2), plusieurs signalements ouverts (2), lien externe (1).

- Visible de l'équipe seulement : file de modération des annonces et `/admin/fraude` (score ≥ 3).
- Alerte de l'équipe (notification « sécurité ») quand une annonce soumise atteint 5.
- Décision toujours humaine, motivée et journalisée ; l'auteur peut faire **recours** (`/admin/recours`) : accepté, le contenu repart en relecture ; un compte n'est réactivé que par un administrateur.

## Charte de confiance et accord de transaction

- `/charte-de-confiance` : engagements de l'annonceur et du visiteur (version datée). L'annonceur s'y engage à chaque soumission ; le visiteur l'accepte avant son premier message (acceptation datée en base, jamais au nom d'un autre ni antidatée).
- `/annonces/[slug]/accord` : accord de transaction imprimable (parties, objet, prix convenu, vérifications, engagements, signatures), modèle indicatif **à faire relire par un juriste** avant le lancement.
- Conseils de sécurité sur chaque annonce et dans la messagerie.

## Protections web

- En-têtes : `Content-Security-Policy` (scripts du site seulement, aucun objet, cadre ni script externe, `frame-ancestors 'none'`, `base-uri` et `form-action` limités au site, connexions limitées à Supabase), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` (en HTTPS). Les scripts en ligne de Next restent autorisés : un nonce est incompatible avec les pages pré-rendues.
- CSRF : actions serveur de Next (vérification d'origine) ; seules routes POST externes : désabonnement (jeton signé) et tâche planifiée (secret).
- XSS : rendu React échappé ; HTML injecté seulement pour les données structurées (sérialisation sûre) ; Markdown du guide restreint, sans HTML ; contenus IA neutralisés.
- Injection SQL : requêtes paramétrées (PostgREST, fonctions), `search_path` vide dans toutes les fonctions.
- SSRF : le serveur n'appelle que des adresses fixes (Supabase, Anthropic, Resend) ; aucune adresse fournie par un membre n'est téléchargée côté serveur.
- Élévation de privilèges : rôles protégés en base (`protect_profile_privileges`), rôles d'administration réservés au superadministrateur, fonctions `SECURITY DEFINER` à contrôle explicite (`is_service_request()`, jamais `current_user`, décision D20).
- Secrets : uniquement côté serveur (`server-only`) ; le smoke vérifie qu'aucune clé n'apparaît dans le code envoyé au navigateur.

## Journal et alertes

- Journal d'audit (`admin_audit_log`) : sanctions, rôles, signalements, recours, fusions, campagnes, IA — auteur, date, raison, avant et après ; historique des contenus (`content_revisions`).
- Alertes : annonces à risque (notification « sécurité » à l'équipe), échecs d'envoi visibles dans `/admin`, état des services dans `/interne/statut`.

## Réponse à incident

1. **Détecter** : alerte, signalement d'un membre, journal, état des services.
2. **Contenir** : suspendre le contenu (`/admin/signalements`) ou le compte (`/admin/comptes`), couper l'IA (`/admin/ia`), passer le site en maintenance (`FEATURE_MAINTENANCE=on`) si nécessaire.
3. **Révoquer** : renouveler les clés exposées (Supabase : clé secrète et jeton d'accès ; Anthropic, Resend, `CRON_SECRET`, `INTERNAL_STATUS_TOKEN`) dans le gestionnaire de secrets, puis redéployer.
4. **Analyser** : journal d'audit, historique des contenus, journaux du serveur (structurés, sans données personnelles).
5. **Informer** : les membres concernés ; l'autorité de protection des données (ARTCI) en cas de violation de données personnelles, dans les délais légaux.
6. **Corriger et documenter** : correctif, test qui reproduit le problème, décision consignée dans `docs/decisions.md`.

## Reste à faire avant le lancement

- Relecture juridique de la charte, de l'accord de transaction et des pages légales.
- Test d'intrusion externe ; revue des politiques de stockage Supabase en production.
- Antivirus ou analyse d'images si un fournisseur est retenu.
