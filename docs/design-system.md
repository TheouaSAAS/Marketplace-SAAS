# Design system

Identité : chaleureuse et claire, évoquant subtilement le littoral (bleu océan), la végétation (vert lagune), la chaleur (orange) et le sable (neutres). Sans clichés ni surcharge. Aperçu vivant : **`/design-system`** (non indexé). Source unique des jetons : `src/app/globals.css`.

## Jetons

| Famille | Jetons | Usage |
| --- | --- | --- |
| Couleurs de marque | `brand-50…950` (océan), `accent-50…900` (orange), `lagoon-*` (vert), `sand-50…900` (neutres) | Toujours via classes (`bg-brand-600`), jamais en hexadécimal dans un composant |
| Sémantiques | `surface`, `surface-muted`, `surface-sunken`, `border`, `border-strong`, `ink`, `ink-muted`, `ink-subtle`, `focus`, `success(-soft)`, `warning(-soft)`, `danger(-soft)`, `info(-soft)` | À préférer dans les composants |
| Typographie | Plus Jakarta Sans ; `text-display` (44 px), `text-3xl` (h1), `text-2xl` (h2), `text-xl`/`text-base` (h3), `text-base` (corps, 16 px), `text-sm` (14 px), `text-xs` (12 px) | Champs ≥ 16 px sur mobile (pas de zoom iOS) |
| Espacements | Échelle Tailwind (4 px) ; marges latérales 16 px mobile, 24 px tablette, 32 px ordinateur (`Container`) ; sections `py-12` | |
| Rayons | `rounded-control` (10 px), `rounded-card` (16 px), `rounded-pill` | |
| Ombres | `shadow-card`, `shadow-raised` (survol), `shadow-overlay` (modales, menus) | |
| Grilles | 1 colonne mobile → `md:grid-cols-2/3` → `lg:grid-cols-4` ; largeur max 1280 px | |

Contraste vérifié automatiquement (`src/app/design-tokens.test.ts`) : texte ≥ 4,5:1, focus ≥ 3:1.

## Points de rupture

Mobile d'abord : base 360 px · `sm` 640 · `md` 768 (tablette) · `lg` 1024 (navigation complète) · `xl` 1280. Cibles tactiles ≥ 44 px (vérifié par test navigateur).

## Micro-interactions

Transitions de couleur et d'ombre de 150 ms, apparitions `animate-fade-in` (150 ms) et `animate-slide-up` (200 ms), rotation des chevrons. Pas d'animation en boucle ni de parallaxe. `prefers-reduced-motion: reduce` neutralise toutes les animations (règle globale).

## Composants (`src/components/ui`)

| Composant | Fichier | Notes |
| --- | --- | --- |
| `Button`, `ButtonLink`, `buttonClasses` | button.tsx | Variantes primary, accent, secondary, ghost, danger ; tailles sm/md/lg/icon ; `loading` |
| `Input`, `Textarea`, `Select`, `Field` | form-controls.tsx | `Field` relie libellé, aide et erreur (`aria-describedby`, `aria-invalid`) |
| `Checkbox`, `Radio`, `RadioGroup`, `Switch` | choice-controls.tsx | Éléments natifs ; `Switch` = case à cocher `role="switch"` |
| `FilterChip`, `FilterBar`, `ActiveFilter` | filter-chip.tsx | `aria-pressed` ; barre défilante sur mobile |
| `Tabs` | tabs.tsx | Motif WAI-ARIA, flèches/Début/Fin, compteurs, onglets désactivés |
| `Card`, `CardBody`, `CardTitle` | card.tsx | `interactive` pour l'effet de survol |
| `Badge`, `StatusBadge`, `SponsoredBadge`, `SoonBadge` | badge.tsx | Statut de **modération** (brouillon → archivée) |
| `VerificationBadge`, `FreshnessNote`, `ToConfirm` | verification.tsx | Statut de **vérification** des données locales (voir data-governance.md) |
| `Avatar` | avatar.tsx | Image ou initiales ; carré pour les organisations |
| `Alert`, `EmptyState`, `ErrorState` | feedback.tsx | Information, succès, avertissement, erreur ; vide ; échec avec reprise |
| `Spinner`, `Skeleton` | spinner.tsx | Chargement |
| `Modal` | modal.tsx | `<dialog>` natif ; variantes dialog, sheet (bas d'écran mobile), drawer |
| `Popover`, `useDismiss` | popover.tsx | Menus déroulants |
| `ToastProvider`, `useToast` | toast.tsx | Notifications éphémères (`aria-live`) |
| `OfflineBanner` | offline-banner.tsx | Bandeau hors ligne (Next `useOffline`, relance automatique) |
| `Container` | container.tsx | Largeur et marges communes |

## Cadre et navigation (`src/components/layout`)

| Composant | Rôle |
| --- | --- |
| `SiteHeader` | En-tête : logo, recherche (≥ 1024 px), ville, favoris, compte, Publier ; barre des rubriques sur une seconde ligne (≥ 1024 px) |
| `MainNav` | Trois menus déroulants (rubriques) + accès signature « Nouveau à San Pedro ? » |
| `MobileNav` | Panneau latéral : recherche, accès signature, Publier, compte, rubriques dépliables |
| `BottomNav` | Barre basse mobile, cinq onglets, `aria-current` sur l'onglet actif, zone de sécurité des écrans à encoche |
| `AssistantLauncher` | Bouton flottant « Demandez à San Pedro », panneau honnête si l'IA est désactivée |
| `Breadcrumbs` | Fil d'Ariane accessible + données structurées `BreadcrumbList` |
| `SectionPreview` | Écran d'attente d'une rubrique (`preview`) |
| `InfoPage`, `Faq` | Pages d'information et questions dépliables |
| `LegalDocument`, `ToComplete` | Pages légales provisoires |
| `SiteFooter` | Quatre colonnes, bandeau « Fiabilité des informations », réseaux configurés seulement |
| `NavItemLink`, `RouteButton` | Liens et boutons qui respectent le statut des routes |

## États obligatoires

Chaque écran qui charge des données prévoit : **chargement** (`Skeleton` aux dimensions du contenu), **vide** (`EmptyState` avec action pour élargir), **erreur** (`ErrorState` avec « Réessayer »), **hors ligne** (bandeau global + `ErrorState offline`), **désactivé** (bouton désactivé avec `title` explicatif ; un service non configuré n'est jamais simulé).

## Règles de différenciation des données

- **Vérifié** : vert, icône de badge, date et source visibles.
- **À vérifier** : ambre, icône d'horloge, « Information à confirmer localement ».
- **Exemple** : bordure pointillée, icône d'éprouvette, « Exemple · à valider localement » ; jamais montré au public en production.
- **Sponsorisé** : orange clair, libellé explicite ; indépendant de la vérification.
