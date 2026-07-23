# Storyboard JSON — field reference

Consumed by `src/pipeline1/storyboard.js` (`loadStoryboard`), called from
`renderVideoFromStoryboardFile` in `src/pipeline3/render.js`.

## Top level

| Field               | Type     | Required | Notes |
|---------------------|----------|----------|-------|
| `voiceoverSegments`  | array    | **yes**  | Non-empty. See below for item shape. |
| `voiceConfig`        | object   | no       | Passed straight to `getSceneTimings`. Shape is whatever your real `getSceneTimings` implementation expects (e.g. `{ voiceId, speed }`); the bundled stub in `src/existing/getSceneTimings.js` only reads `speed`. |
| `outputPath`         | string   | no       | Resolved **relative to the storyboard file's own directory**, so storyboards stay portable across machines/repos. Defaults to `out/MainVideo.mp4` under the project root if omitted. A CLI-supplied output path always wins over this field. |
| `fps`                | number   | no       | Overrides `config.js`'s `FPS` (default 30) for this render only. Must be a positive integer — enforced in `computeSceneFrameTimings`. |
| `width`              | number   | no       | Overrides `config.js`'s `VIDEO_WIDTH` (default 1080). |
| `height`             | number   | no       | Overrides `config.js`'s `VIDEO_HEIGHT` (default 1920). |
| `masterSeed`         | string   | no       | Reserved for overriding `config.js`'s `MASTER_SEED` on a per-storyboard basis. Not yet wired into the seeded PRNG call site — if you need per-storyboard determinism today, set the `MASTER_SEED` env var instead. |

## `voiceoverSegments[]` item

| Field            | Type            | Required | Notes |
|------------------|-----------------|----------|-------|
| `id`             | string          | **yes**  | Stable scene identifier. Shows up in `unmatched_scenes.json` and Remotion `<Sequence>` keys. |
| `text`           | string          | **yes**  | The voiceover line for this scene. Drives both timing (via `getSceneTimings`) and template scoring (char-capacity fit + optional cosine similarity + keyword matching). |
| `type`           | string \| null  | no       | Should match a template's `manifest.key` (e.g. `"quote"`, `"image-panel"`) for an exact-key score boost. Leave `null`/omitted to rely on capacity + cosine similarity + keyword matching alone. |
| `embedding`      | number[]        | no       | Scene embedding for cosine similarity against `manifest.embedding`. **Must have the same length as the template manifests' embeddings** (`cosineSimilarity` throws `Embedding dimension mismatch` otherwise — see `src/utils/cosineSimilarity.js`). Only include this if you're actually generating embeddings; there's no benefit to a placeholder vector. |
| `keywords`       | string[]        | no       | **Array of descriptive keywords for this scene** (e.g. `["quote", "inspiration", "wisdom"]`). Used for keyword matching against template `manifest.keywords` via Jaccard similarity. Combined with cosine similarity and exact-key matching for composite scoring. Recommended as a lightweight alternative to embeddings. |
| `media`          | object          | no       | Maps an asset-slot name (from the matched template's `manifest.assetSlots`, e.g. `background`, `media`) to a remote URL. Must start with `http://` or `https://` to be treated as a remote override (`src/pipeline2/templating.js`'s `resolveAssetUrl`) — anything else is ignored and the template's local `/assets` file is used instead. |
| `styleOverrides` | object          | no       | Shallow-merged **on top of** the template's chosen style variant in `hydrateScene` (`src/pipeline2/templating.js`). Use the same keys the template's `manifest.json` `styleVariants[].colors`/`fontFamily` use — check the specific template's manifest for what it actually reads. |

## Full example

See `references/example.storyboard.json` in this same folder for a
ready-to-copy storyboard exercising every optional field, including one
scene deliberately designed to miss every template match (no `type`, an
`embedding` far from any manifest's, no `keywords`) to show what a fallback-bound scene
looks like.

## What happens after loading

`loadStoryboard()` only validates *shape* (required fields present, correct
JS types). It does not know about templates at all — matching happens later
in Pipeline 1 (`src/pipeline1/scoring.js`) once `renderVideo()` calls
`runPipelinesOneAndTwo()`. A storyboard that passes `loadStoryboard()` can
still produce scenes that fall back to the primitive template if no
template scores above `THRESHOLD` — that's expected, not an error, and is
exactly what `unmatched_scenes.json` is for.
