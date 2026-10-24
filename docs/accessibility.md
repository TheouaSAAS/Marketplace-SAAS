# Accessibilité (WCAG 2.2 AA)

Audit du **niveau 25**, le 24/10/2026. Rejoué à chaque `npm run check` par `e2e/accessibility.spec.ts`.

## Audit automatique (axe-core 4.13, règles WCAG 2.0, 2.1 et 2.2 A et AA)

- 30 pages publiques sur mobile et sur ordinateur (rubriques, recherche, carte, parcours nouvel arrivant, aide, connexion, inscription, fiches annonce, lieu, événement, professionnel, article du guide, quartier).
- 15 pages connectées en lecture seule : profil, tableau de bord (vue d'ensemble, annonces, activité, notifications, confidentialité), publication, messagerie, favoris ; administration (accueil, signalements, comptes, journal, qualité, IA).
- Bloquant : toute violation « grave » ou « critique ». Résultat : **aucune violation, toutes gravités confondues**, après deux corrections :
  - cartes Leaflet décrites comme une « image » alors qu'elles contiennent des contrôles (zoom, attribution) : désormais une figure légendée ;
  - tableaux défilants du journal et de la consommation IA : atteignables au clavier (zone focalisable nommée).
- Contrôles complémentaires : mouvement réduit appliqué (`prefers-reduced-motion` : animations et transitions neutralisées), focus clavier visible dès le lien « Aller au contenu ».

## Acquis des niveaux précédents (vérifiés par les tests e2e)

Navigation entièrement au clavier, lien d'évitement, onglets au motif WAI-ARIA, libellés et messages d'erreur reliés aux champs (`Field`), annonces des résultats de formulaire (`aria-live`), contraste des couleurs de marque ≥ 4,5:1, aucun débordement horizontal à 360 px, cibles tactiles de 44 px.

## Reste à vérifier manuellement (avant le lancement)

- Lecteurs d'écran réels : TalkBack (Android, le plus répandu localement), NVDA (Windows), VoiceOver (iOS).
- Zoom à 200 % et 400 % (refusion), mode contraste élevé de Windows.
- Carte : alternative textuelle complète déjà présente (liste synchronisée) ; parcours au clavier de la carte elle-même à éprouver avec des utilisateurs.
