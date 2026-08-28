# Convertisseur local

Un convertisseur de fichiers **100 % côté client** : tout est calculé dans
l'onglet du navigateur, aucun fichier n'est envoyé sur un serveur.

Documents, tableurs, images, audio, vidéo, archives, polices, modèles 3D et
code source — le tout avec WebAssembly, l'élément `<canvas>`, la Web Audio API
et quelques bibliothèques JavaScript spécialisées.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

`npm run dev` et `npm run build` déclenchent d'abord `scripts/prepare-assets.mjs`,
qui copie dans `public/` les binaires WebAssembly chargés à la demande
(ffmpeg-core, le worker pdf.js, les bindings wawoff2). Ces fichiers ne sont pas
versionnés : ils sont régénérés à chaque installation.

## Déploiement

Le projet est un Next.js standard, prêt pour Vercel : importez le dépôt, aucune
variable d'environnement n'est nécessaire. `npm run build` (donc `prebuild`)
s'exécute automatiquement.

`next.config.mjs` ajoute `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: credentialless`, ce qui active `SharedArrayBuffer`
tout en laissant les CDN publics accessibles.

## Ce que l'application sait convertir

| Catégorie | Conversions |
| --- | --- |
| Documents | DOCX → HTML / Markdown / TXT / PDF · Markdown → HTML / PDF / DOCX / TXT · HTML → PDF / DOCX / Markdown / TXT / image · PDF → images page par page, texte · RTF → HTML / TXT / Markdown · TXT → PDF |
| Tableurs & données | XLSX, XLS, ODS → CSV / JSON / HTML / XML · CSV → JSON / XLSX / XML / HTML · JSON → CSV / XLSX / XML / HTML · XML → JSON / CSV / XLSX |
| Images | JPG, PNG, WebP, BMP, GIF, TIFF, HEIC, SVG → PNG / JPG / WebP (avec échelle, qualité, couleur de fond) · GIF animé → séquence d'images ou sprite sheet |
| Audio | Tout média → MP3 / WAV / OGG / AAC / FLAC · Parole → TXT / SRT / VTT (Whisper) |
| Vidéo | Vidéo → MP4 / WEBM / MKV / AVI / MOV / GIF · Vidéo → séquence d'images, mosaïque de vignettes · Suite d'images → MP4 / WEBM / GIF |
| Archives | N'importe quels fichiers → ZIP / TAR / TAR.GZ / GZ · ZIP, TAR, TAR.GZ, GZ → fichiers extraits |
| Polices | TTF, OTF → WOFF / WOFF2 · WOFF, WOFF2 → TTF |
| 3D | OBJ, STL → GLB / glTF · glTF → GLB |
| Code | SCSS, SASS → CSS · LESS → CSS · TS → JS · TSX, JSX → JS |

## Interface

Papier chaud, encre noire, un seul accent vermillon, des filets d'un pixel et
aucun dégradé. Les couleurs vivent dans six variables CSS déclarées une fois
dans `app/globals.css`, redéfinies pour `prefers-color-scheme: dark` (charcoal
chaud, pas bleuté). Typographie : Instrument Serif pour le titre et la marque,
IBM Plex Sans pour l'interface, IBM Plex Mono pour les codes de format, les
tailles et les libellés de champs. Les trois sont auto-hébergées par
`next/font`, donc la page fonctionne sans connexion.

L'outil est construit comme un panneau à trois étapes numérotées (fichiers,
format, réglages) plutôt que comme une page d'accueil marketing, et le
catalogue est un vrai tableau trié par famille de formats.

## Architecture

```
app/                 page unique (App Router) + styles globaux
components/          interface : dépôt de fichiers, choix du format, réglages, résultats
lib/types.ts         le contrat `Converter`
lib/registry.ts      catalogue et sélection des conversions applicables
lib/converters/      une implémentation par famille de formats
lib/ffmpeg.ts        chargement paresseux de ffmpeg-core + exécution d'une commande
scripts/             préparation des binaires Wasm avant le build
```

Ajouter une conversion revient à écrire un objet `Converter` (identifiant,
formats d'entrée, format de sortie, réglages, fonction `run`) et à l'ajouter au
tableau de `lib/registry.ts`. L'interface s'adapte toute seule.

Toutes les bibliothèques lourdes (FFmpeg, pdf.js, SheetJS, Whisper, three.js,
Dart Sass, TypeScript…) sont chargées par `import()` dynamique : la page
d'accueil ne pèse que ~130 ko de JavaScript.

## Notes techniques

- **PDF → Word éditable** n'est pas proposé : un PDF décrit un dessin, pas une
  structure de document. `PDF → images` et `PDF → texte` couvrent les usages
  réalistes. `PDF → texte` échoue explicitement sur un PDF scanné (aucune
  couche texte, et il n'y a pas d'OCR).
- **FFmpeg** est la version mono-thread (~32 Mo) téléchargée une seule fois par
  session, depuis notre propre domaine.
- **Whisper** télécharge son modèle depuis Hugging Face au premier usage
  (~50 à 250 Mo selon la taille choisie) et utilise WebGPU quand il est
  disponible.
- **Opus** n'est pas proposé en sortie : l'encodeur libopus de ffmpeg-core
  plante en WebAssembly. OGG (Vorbis), AAC, MP3, WAV et FLAC le remplacent.
