# Runbook d’exploitation

Pour l’équipe qui fait tourner la plateforme. Déploiement et configuration : `docs/deployment.md` ; sécurité et fuite de données : `docs/security.md`.

## Routine

| Quand | Quoi |
| --- | --- |
| Chaque jour (bêta, premières semaines) | `/interne/statut?token=…` : alertes d’exploitation, file de modération (aucune annonce en attente depuis plus de 24 h), notifications en échec, tâches planifiées en échec. `/admin` : signalements, recours, fraude. |
| Chaque semaine | Coûts (base, stockage, IA, e-mails, hébergement) ; volume de la base et du stockage ; `npm run db:backups` ; journaux d’erreurs (empreintes récurrentes). |
| Chaque mois | Mises à jour de sécurité des dépendances (`npm audit --omit=dev`), rotation des secrets partagés si une personne quitte l’équipe, revue des comptes administrateurs. |
| Avant chaque mise en production | Liste « Avant chaque mise en production » de `docs/deployment.md`. |

## Mise en production pas à pas

1. Vérifier « Qualité » vert sur le commit à livrer.
2. Actions > « Déploiement » > `preproduction`, étape `migrations` ; attendre le vert (contrôles, migrations, `db:verify`).
3. Laisser l’hébergeur déployer la branche de préproduction ; Actions > « Déploiement » > `preproduction`, étape `verification`.
4. Essais manuels ciblés sur ce qui change.
5. Mêmes étapes 2 et 3 pour `production` (approbation requise) ; `npm run db:backups` juste avant.
6. Surveiller `/interne/statut` et le canal d’alerte pendant une heure.

## Retour arrière

| Situation | Action | Délai |
| --- | --- | --- |
| Régression du code | Redéployer la version précédente (Vercel : Instant Rollback ; sinon commit précédent) | minutes |
| Fonctionnalité défaillante (IA, carte, temps réel, e-mails…) | `FEATURE_<CLÉ>=off` puis redéploiement ou redémarrage | minutes |
| Incident grave en cours | `FEATURE_MAINTENANCE=on` (503 partout, supervision joignable) | minutes |
| Migration fautive | Migration compensatoire (nouvelle migration), testée en préproduction, puis production | heure |
| Données corrompues ou supprimées | Restauration (ci-dessous) | heures |

## Restauration de la base

Prérequis (☐ à mettre en place avant l’ouverture) : forfait avec sauvegardes quotidiennes ou PITR, et/ou `pg_dump` externe récent.

1. Mettre le site en maintenance (`FEATURE_MAINTENANCE=on`) si des écritures risquent d’aggraver la situation.
2. Identifier l’instant à restaurer (journal `admin_audit_log`, journaux de l’hébergeur, empreintes d’erreurs).
3. Restaurer **dans un nouveau projet** Supabase (ou en préproduction) depuis la sauvegarde ou le `pg_dump`, puis vérifier : `npm run db:status` (migrations), `npm run db:verify`, contrôle des données concernées.
4. Basculer : soit restaurer le projet de production lui-même (tableau de bord Supabase > Database > Backups, écrase tout ce qui a été écrit depuis), soit pointer l’application vers le nouveau projet (variables `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SECRET_KEY`, rebuild) et reprendre les réglages d’authentification (`npm run db:auth-config`), le stockage et les tâches planifiées.
5. Appliquer les migrations postérieures à la sauvegarde (`npm run db:migrate`).
6. Retirer la maintenance, vérifier (`verification`), informer les personnes concernées si des données ont été perdues.
7. Consigner l’incident (ci-dessous).

## Checklist incident

1. **Constater** : quoi, depuis quand, qui est touché (`/interne/statut`, `/api/health/ready`, canal d’alerte, journaux par empreinte `digest`).
2. **Qualifier** : panne totale, fonctionnalité dégradée, faille ou fuite de données (→ procédure de `docs/security.md`, notification aux personnes et à l’autorité si des données personnelles sont exposées).
3. **Contenir** : couper la fonctionnalité (drapeau), maintenance, révoquer un secret exposé (clé Supabase, jetons, webhook), suspendre un compte abusif.
4. **Communiquer** : message court aux utilisateurs si l’incident est visible (page de maintenance, réseaux), sans détail technique ni spéculation.
5. **Corriger** : correctif testé en préproduction ; jamais de correction directe en base sans trace (passer par une migration ou une action journalisée).
6. **Vérifier** : `verification`, `/interne/statut` sans alerte.
7. **Consigner** : date, durée, cause, impact, actions, prévention (dans le suivi de l’équipe).

## Comptes de l'équipe

- **Premier superadministrateur** : la personne s'inscrit sur le site et confirme son adresse, puis `npm run db:promote -- <adresse> superadmin` sur le poste d'exploitation (contexte système, journalisé ; refuse une adresse inconnue ou non confirmée) ; elle configure son second facteur à sa première connexion sur `/admin/connexion`.
- **Autres rôles** : attribués dans `/admin/comptes` (raison obligatoire, journalisée) ; l'administrateur ne crée pas d'administrateur, seul un superadministrateur le fait.
- **Téléphone perdu** : un superadministrateur vérifie l'identité de la personne (hors ligne), puis « Réinitialiser le second facteur » dans `/admin/comptes` ; la personne en configure un nouveau à sa connexion suivante.
- **Départ d'un membre de l'équipe** : lui retirer son rôle dans `/admin/comptes` le jour même.
- **Échecs répétés** : visibles dans `/admin/journal` (« Accès à l'administration ») et signalés dans les journaux ; au-delà de 5 essais en 15 minutes, la connexion est bloquée temporairement.

## Services externes en panne

| Service | Effet | Le site reste utilisable ? |
| --- | --- | --- |
| Supabase (base) | contenus et comptes indisponibles, messages « momentanément indisponible » | pages d’information et aide oui ; `/api/health/ready` en 503 |
| Supabase Realtime | listes rechargées chaque minute | oui |
| Fournisseur d’IA | assistant et recherche par règles fixes ; coupure automatique au-delà du budget | oui |
| E-mails | notifications dans le site, envois repris plus tard par la file | oui (inscription limitée) |
| Tuiles de carte | listes sans carte | oui |

## Contacts et accès

☐ À compléter par l’équipe : responsables (technique, modération, données locales), accès aux tableaux de bord (hébergeur, Supabase, fournisseur d’e-mails, d’IA, registraire du domaine), personne d’astreinte pendant la bêta. Deux personnes au moins doivent pouvoir effectuer un retour arrière.
