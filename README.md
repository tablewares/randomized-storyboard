# Video Generation Engine (Remotion, 3-pipeline)

A deterministic, template-driven video generation engine built on Remotion.
Three pipelines, each with a single responsibility:

```
voiceoverSegments + voiceConfig
        │
        ▼
┌───────────────────────────┐
│ PIPELINE 1                │  src/pipeline1/
│ Timing & Template Scoring │
└───────────────────────────┘
        │  scenes annotated with startFrame/durationInFrames + matchedTemplate
        ▼
┌───────────────────────────┐
│ PIPELINE 2                │  src/pipeline2/
│ Deterministic Templating  │
└───────────────────────────┘
        │  hydratedScenes (resolved bounding boxes, styles, asset URLs)
        ▼
┌───────────────────────────┐
│ PIPELINE 3                │  src/pipeline3/
│ Remotion Rendering        │
└───────────────────────────┘
        │
        ▼
      MP4 output
```

## Install

```bash
npm install
```

## Run a render

```bash
npm run render
```

This runs `src/pipeline3/render.js`'s example, which uses a small
hard-coded `voiceoverSegments` array. Wire in real segments by calling
`renderVideo({ voiceoverSegments, voiceConfig, outputPath })` from your own
script.

### Offline / restricted-network environments

`renderMedia`/`selectComposition` normally auto-download a Chrome Headless
Shell binary on first use. If your network egress doesn't allow that host,
point Remotion at any existing Chrome/Chromium/Puppeteer install instead:

```bash
export REMOTION_BROWSER_EXECUTABLE=/path/to/chrome-headless-shell
npm run render
```

`render.js` reads this env var and passes it as `browserExecutable` to both
`selectComposition` and `renderMedia`.

## Preview in Remotion Studio

```bash
npm run studio
```

Studio opens with `hydratedScenes: []` (the `defaultProps` in
`src/pipeline3/index.jsx`) — pass real `inputProps` via the Studio UI or
`--props` to preview an actual scene list.

## Pipeline 1 — Timing & Template Selection

- `src/pipeline1/timing.js` calls the existing `getSceneTimings(voiceoverSegments, voiceConfig)`
  (stubbed in `src/existing/getSceneTimings.js` — **replace this with your
  real implementation**) and converts its seconds-based output into strict
  integer frame counts using the global `FPS` (`src/config.js`, default 30).
- `src/pipeline1/scoring.js` scores every scene against every template
  manifest under `/templates` using three weighted signals (see
  `SCORING_WEIGHTS` in `src/config.js`):
  - exact key match (`scene.type === manifest.key`)
  - character-count capacity fit (`manifest.capacity.minChars/maxChars`)
  - cosine similarity between `scene.embedding` and `manifest.embedding`
  - If the best score is below `THRESHOLD`, `/templates-secondary` is tried.
  - If still unmatched, the scene is logged to `unmatched_scenes.json` and
    assigned the primitive `_fallback` template.

## Pipeline 2 — Templating Engine

- Template standard: a folder with `manifest.json`, an `index.jsx` (or
  `.tsx`/`.js`), and an `/assets` directory (`src/utils/fsHelpers.js`
  enforces this).
- `src/pipeline2/seededRandom.js` creates a PRNG via
  `seedrandom(masterSeed + "_" + sceneIndex)` — the **only** source of
  randomness anywhere in this pipeline. `Math.random()` is never used, so
  re-rendering the same scenes with the same `MASTER_SEED` always produces
  identical layouts/styles.
- `src/pipeline2/templating.js` hydrates each matched scene: it picks a
  layout/style variant with the scene's RNG, resolves bounding boxes (with a
  bounded deterministic jitter), merges style overrides, and resolves every
  asset slot to either the scene's remote URL or the template's local asset.

## Pipeline 3 — Remotion Rendering Engine

- `src/pipeline3/Composition.jsx` maps each hydrated scene onto a
  `<Sequence from={startFrame} durationInFrames={durationInFrames}>`.
- `src/pipeline3/templateRegistry.js` statically imports every template
  component so Remotion's webpack bundler can include them — **register any
  new template here**.
- Templates use `<Img />` and `<OffthreadVideo />` (never `<img>`/`<video>`)
  for all remote/local media, per Remotion's guidance for avoiding asset
  timeout errors during rendering.
- `src/pipeline3/render.js` calls `bundle()` then `selectComposition()` +
  `renderMedia()` from `@remotion/bundler` / `@remotion/renderer`.

## Templates included

| key            | folder                 | purpose                                   |
|----------------|-------------------------|--------------------------------------------|
| `quote`        | `templates/quote`        | full-bleed background + centered quote     |
| `image-panel`  | `templates/image-panel`  | media panel (image/video) + caption panel  |
| `_fallback`    | `templates/_fallback`    | primitive text-only card, no assets needed |

## Extending

1. Add a new folder under `/templates` (or `/templates-secondary`) with
   `manifest.json`, `index.jsx`, `/assets`.
2. Give the manifest a `key`, `capacity`, `embedding`, `layoutVariants`,
   `styleVariants`, and `assetSlots`.
3. Register the component in `src/pipeline3/templateRegistry.js`.
