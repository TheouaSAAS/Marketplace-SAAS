# Performance

Mesures du **niveau 25**, prises le 24/10/2026 sur le build de production (`npm run build`, `next start`), profil mobile Playwright (Pixel 7, Edge), sans bridage réseau. Elles sont rejouées à chaque `npm run check` par `e2e/performance.spec.ts`, qui échoue au-delà du budget.

## Méthode

- Ressources **du site** demandées avant la fin de l'événement `load` : page HTML, JavaScript, CSS, polices. Images et tuiles de carte exclues (chargées à la demande, sans bloquer l'affichage).
- Poids **compressé** : chaque ressource est retéléchargée hors navigateur puis compressée (gzip). Sur le poste de développement, un antivirus réécrit le trafic du navigateur (scripts injectés, pages décompressées) : les mesures du navigateur seraient fausses.
- Stabilité visuelle (CLS) et plus grand affichage (LCP) relevés dans la page.
- Les liens préchargés après le chargement (navigation instantanée) sont comptés à part, en nombre de requêtes.

## Budget et résultats

| Page | HTML | JavaScript | Total initial | Préchargements | CLS | LCP local |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 33 Ko | 195 Ko | 265 Ko | 31 | 0 | 1,5 s |
| `/immobilier/location` | 26 Ko | 196 Ko | 259 Ko | 20 | 0 | 1,6 à 2,3 s |
| `/evenements` | 22 Ko | 195 Ko | 255 Ko | 25 | 0 | 1,2 s |
| `/guide` | 22 Ko | 195 Ko | 254 Ko | 20 | 0 | 0,7 à 1,0 s |
| `/professionnels` | 24 Ko | 195 Ko | 257 Ko | 18 | 0 | 1,2 à 1,6 s |
| `/carte` | 22 Ko | 201 Ko | 263 Ko | 16 | 0 | 1,2 à 1,4 s |
| `/lieux/[slug]` (avec carte) | 23 Ko | 204 Ko | 267 Ko | 18 | 0 | 1,3 à 1,7 s |
| **Budget bloquant** | — | **230 Ko** | **300 Ko** | — | **0,1** | **4 s** |

Le LCP local dépend surtout du temps de réponse de la base Supabase distante ; l'objectif en production reste **2,5 s** (seuil « bon » des Core Web Vitals), le seuil bloquant de 4 s n'évite que les régressions franches.

## Ce qui allège les pages

- Rendu serveur et Cache Components : les pages publiques arrivent rendues ; les parties dépendant de la requête sont envoyées en flux (`Suspense`).
- Carte : Leaflet est chargé dans le navigateur seulement, après l'affichage (`import()` dans un effet) ; les pages avec carte n'ajoutent que 6 à 9 Ko au chargement initial, tuiles comprises à la demande.
- Images : `next/image` (formats modernes, tailles adaptées, chargement différé), y compris la galerie des lieux (stockage public autorisé dans `next.config.ts`).
- Police : un seul fichier préchargé (sous-ensemble `latin`, qui couvre le français), `display: swap`.
- Hors ligne : service worker et page « Hors ligne » ; relance automatique des navigations sur réseau instable (`experimental.useOffline`).

## Dépend du déploiement réel (à mesurer en production)

- Core Web Vitals des visiteurs (données de terrain : Search Console, rapport Chrome UX) : réseau mobile ivoirien, appareils d'entrée de gamme.
- Compression Brotli et cache CDN des fichiers `/_next/static` (immuables) : selon l'hébergeur.
- Temps de réponse de la base selon la région du projet Supabase (latence vers l'Afrique de l'Ouest).
- Préchargement des liens : utile en Wi-Fi, coûteux en données mobiles ; à réévaluer avec les mesures de terrain (16 à 32 requêtes légères par page).
