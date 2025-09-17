# PixelLab

Mini éditeur d'images front-end conçu avec HTML, CSS et JavaScript natif. Aucun build ni dépendance externe : ouvrez simplement `index.html` dans un navigateur moderne.
Visiter sur : https://bot0m.github.io/PixelLab/

## Structure du projet

```
PixelLab/
├── assets/            # Ressources statiques (icônes, presets)
├── index.html         # Structure principale de l'interface
├── README.md          # Documentation
└── src/
    ├── scripts/
    │   ├── app.js         # Bootstrap, import, recadrage, export
    │   ├── filters.js     # Configuration des filtres & helpers
    │   ├── history.js     # Pile undo basée sur snapshots
    │   └── shortcuts.js   # Normalisation et registre des raccourcis
    └── styles/
        └── main.css       # Layout général et styles
```

## Installation & lancement (FR)

1. **Télécharger le projet**
   - Option A : sur GitHub, cliquer sur « Code » → « Download ZIP », puis extraire l’archive.
   - Option B : via Git `git clone https://github.com/<votre-compte>/PixelLab.git`
2. **Ouvrir l’application**
   - Aucun build ni dépendance : double-cliquez sur `index.html` ou glissez-le dans un navigateur moderne (Chrome, Edge, Firefox, Safari ≥ 15).

## Fonctionnalités clés

- **Vue d’ensemble instantanée** via `<canvas>` avec filtres (contraste, saturation, flou) et recadrage interactif.
- **Historique** : `Annuler` (Ctrl/Cmd + Z) revient d’un pas en arrière, `Rétablir original` (Ctrl/Cmd + Shift + Z) recharge l’état initial.
- **Recadrage** : activez le mode, dessinez un rectangle et relâchez pour appliquer la sélection.
- **Export avancé** : un bouton dédié ouvre un modal centré pour choisir nom, format (PNG, JPEG, WebP, SVG, PDF) et dimensions, avec estimation dynamique de la taille finale.
- **Thème clair/sombre** : interrupteur animé dans l'en-tête, synchronisé avec la préférence système et mémorisé localement.
- **Aide flottante** : l’icône ℹ️ ouvre un mini-modal en haut à droite avec tous les raccourcis sans décaler la mise en page.

## Pipeline de rendu

`renderImage()` (`src/scripts/app.js:162`) calcule la zone à dessiner à partir de l’état de recadrage puis applique les filtres via `context.filter` :

```js
const crop = state.transform.crop;
const sx = Math.round(crop.x * sourceWidth);
const sy = Math.round(crop.y * sourceHeight);
const sWidth = Math.round(crop.width * sourceWidth);
const sHeight = Math.round(crop.height * sourceHeight);
context.filter = composeFilterString(state.filters);
context.drawImage(state.image, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
```

Chaque modification (filtres, recadrage) pousse un snapshot `{ filters, transform }` dans `history.js`. Le bouton **Rétablir original** recharge simplement le tout premier snapshot enregistré (`state.initialSnapshot`).

## Export multi-formats

Les dimensions d’export suivent par défaut la taille du canvas mais peuvent être personnalisées : 
- cochez/décochez « Suivre la taille du canvas » et ajustez largeur/hauteur (ratio verrouillable).
- Pour SVG, le canvas est encodé dans un `<image>` embarqué.
- Pour PDF, un PDF minimaliste est généré et embarque le rendu JPEG du canvas.

Shortcut utiles :

- `Ctrl/Cmd + O` : ouvrir une image.
- `Ctrl/Cmd + Z` : annuler.
- `Ctrl/Cmd + Shift + Z` : rétablir l'état initial.
- `Ctrl/Cmd + Shift + F` : réinitialiser uniquement les filtres.
- `Ctrl/Cmd + Shift + C` : basculer le mode recadrage.
- `Ctrl/Cmd + E` : ouvrir le modal d'export (puis confirmer).
- `Ctrl/Cmd + I` : afficher/fermer le modal d’aide.

## Étapes suivantes (optionnel)

1. **Handles de recadrage** : permettre de redimensionner la sélection existante plutôt que de dessiner à chaque fois.
2. **Transformations avancées** : ajouter rotation et redimensionnement proportionnel dans `state.transform` et appliquer `context.translate/rotate` avant `drawImage`.
3. **Exports paramétrables** : proposer la qualité JPEG/WebP, fond transparent/opaque, et fichiers multipages PDF.

## Utilisation & tests

- Ouvrer `index.html` dans un navigateur moderne (Chrome, Edge, Firefox, Safari ≥ 15).
- Importer ou déposer une image, jouer avec les filtres, activer le recadrage (⇧C) pour dessiner une zone.
- Régler les options d’export (nom, format, dimensions) puis cliquer sur **Exporter**.
- Les navigateurs compatibles (Chromium, Edge) affichent un sélecteur d’emplacement grâce à l’API File System ; sinon le fichier est déposé dans les téléchargements.

Aucun serveur ni compilation n’est nécessaire : le projet fonctionne directement depuis le système de fichiers.

## Installation & quick usage (EN)

1. **Download the project**
   - Option A: on GitHub click “Code” → “Download ZIP”, then unzip the archive.
   - Option B: `git clone https://github.com/<your-account>/PixelLab.git`
2. **Launch the app**
   - No build or dependencies: double-click `index.html` or drag it into a modern browser (Chrome, Edge, Firefox, Safari ≥ 15).

### Key features

- **Instant canvas preview** with contrast/saturation/blur filters and interactive cropping.
- **History**: `Undo` (Ctrl/Cmd + Z) steps back, `Restore original` (Ctrl/Cmd + Shift + Z) reloads the initial state.
- **Crop tool**: toggle the mode, draw a rectangle, release to apply.
- **Advanced export**: modal with filename, format (PNG, JPEG, WebP, SVG, PDF) and size controls; the estimated file size updates live.
- **Light/Dark theme toggle** synced with OS preference and stored locally.
- **FR/EN switcher** updating every label.
- **Help overlay** accessible via the ℹ️ button.

### Handy shortcuts

- `Ctrl/Cmd + O`: open file dialog.
- `Ctrl/Cmd + Z`: undo.
- `Ctrl/Cmd + Shift + Z`: restore initial state.
- `Ctrl/Cmd + Shift + F`: reset filters.
- `Ctrl/Cmd + Shift + C`: toggle crop mode.
- `Ctrl/Cmd + E`: open export modal.
- `Ctrl/Cmd + I`: toggle help modal.

### Usage tips

- Open `index.html` in a modern browser.
- Import or drop an image, adjust filters, toggle crop mode (⇧C) to draw a selection.
- Fine-tune export options in the modal, then confirm to download.
- Chromium-based browsers expose the File System API to pick the destination; others download to the default folder.
