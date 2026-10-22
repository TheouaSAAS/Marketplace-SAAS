# Modules métier

Chaque domaine fonctionnel vit dans son dossier, avec la même structure :

```
src/modules/<domaine>/
  domain/       règles pures, types, schémas Zod (testables sans base ni navigateur)
  server/       requêtes (repositories), actions serveur, intégrations — `import "server-only"`
  components/   composants d'interface propres au domaine
  index.ts      ce que les autres domaines ont le droit d'importer
```

Un domaine n'importe pas les fichiers internes d'un autre : il passe par son `index.ts`.
Le socle partagé reste hors des modules : `src/components/ui` (design system), `src/components/layout` (shell),
`src/lib` (technique), `src/config` (routes, menus, drapeaux), `src/domain` (notions transverses : statuts, rôles, géographie, ville).

| Domaine | Niveau | Contenu |
| --- | --- | --- |
| `accounts` | 3 | inscription, connexion, profil, consentements, export, suppression |
| `organizations` | 2, 19, 21 | organisations, membres, vitrines professionnelles |
| `listings` | 7, 8, 18 | annonces, attributs dynamiques, médias, publication |
| `real-estate` | 9 | spécialisation immobilière des annonces |
| `services` | 10 | métiers, prestataires, demandes de devis |
| `shops` | 11 | vitrines de commerces, horaires sourcés, revendications, sponsorisés |
| `admin` | 10, 22 | référentiel des catégories (puis administration complète) |
| `tourism` | 12 | entrées « Découvrir », exploration filtrable, itinéraires déterministes, infos pratiques |
| `guide` | 13 | rubriques, articles (Markdown restreint, sommaire, statut, versions), suggestions, rédaction, ressources liées, préparation de l’assistant |
| `neighborhoods` | 14 | fiches neutres, onglets de ressources rattachées, périmètres (brouillon, validation, historique), administration |
| `map` | 15 | couches, filtres dans l’adresse, regroupement des marqueurs, carte et liste synchronisées, fiche rapide |
| `events` | 16 | événements |
| `jobs` | 17 | emploi et opportunités |
| `newcomer` | 6 | parcours « Nouveau à San Pedro ? » |
| `search` | 7 | recherche transversale |
| `messaging` | 8 | conversations |
| `notifications` | 24 | centre de notifications, e-mails |
| `moderation` | 22 | files, audit, qualité |
| `ai` | 23 | fournisseurs, RAG, garde-fous |
