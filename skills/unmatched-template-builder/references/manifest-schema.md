# Template `manifest.json` — field reference

Read by `src/utils/fsHelpers.js` (`loadTemplateManifests`) and scored by
`src/pipeline1/scoring.js`. Consumed for hydration by
`src/pipeline2/templating.js`.

| Field                 | Type   | Required | Used by |
|-----------------------|--------|----------|---------|
| `key`                 | string | recommended (falls back to folder name) | Exact-key scoring signal; also what scenes set as `type` and what `templateRegistry.js` keys off of. |
| `description`         | string | no | Human documentation only. |
| `capacity.minChars`    | number | no (default 0) | Char-capacity scoring signal, against `scene.text.length`. |
| `capacity.maxChars`    | number | no (default ∞) | Same. |
| `embedding`           | number[] | no | Cosine-similarity scoring signal against `scene.embedding`. **Every template's embedding must share the same dimensionality** — `cosineSimilarity` throws `Embedding dimension mismatch` otherwise. |
| `maxLayoutJitterPx`    | number | no (default 12) | Bound on the deterministic per-scene bounding-box jitter applied in `hydrateScene`. |
| `assetSlots`          | object | no (default `{}`) | Maps an asset-slot name (referenced by the component as `layout.assets.<name>`) to a filename under this template's `assets/` dir, used when the scene doesn't supply a `media.<name>` remote URL override. |
| `layoutVariants`      | array  | no (falls back to a single `"default"` variant with no bounding boxes) | Each entry: `{ name, boundingBoxes: { <regionName>: { x, y, w, h } } }`. One is picked deterministically per scene via the seeded RNG. |
| `styleVariants`       | array  | no (falls back to a single `"default"` variant) | Each entry: `{ name, colors: {...}, fontFamily }`. Field names inside `colors` are template-specific — the component defines what it reads (e.g. `quote`'s component reads `colors.text`/`colors.attribution`/`colors.overlay`). One is picked deterministically per scene via the seeded RNG, then shallow-merged with any scene-level `styleOverrides`. |

## Scoring weights (for context, not part of the manifest)

Composite score = `exactKeyScore * 0.4 + charCapacityScore * 0.25 +
cosineScore * 0.35` by default (see `SCORING_WEIGHTS` in `src/config.js`).
`charCapacityScore` is 1.0 inside the capacity band and falls off linearly
outside it, scaled by the band width (or a 100-char assumed band if
`maxChars` is unbounded) — so a huge/unbounded capacity band (like the
`_fallback` template's) always scores a nontrivial 0.25 from capacity alone,
which is why the fallback template is explicitly excluded from the scored
candidate pool in `matchScenesToTemplates` rather than being allowed to
"win" a match.

## Minimal example

```json
{
  "key": "listicle",
  "description": "Numbered list card for 'top N' / rapid-fact scenes.",
  "capacity": { "minChars": 80, "maxChars": 320 },
  "embedding": [0.2, 0.6, 0.1, 0.5, 0.3, 0.4, 0.2, 0.55],
  "assetSlots": { "background": "assets/bg-listicle.jpg" },
  "layoutVariants": [
    { "name": "stacked", "boundingBoxes": { "list": { "x": 100, "y": 500, "w": 880, "h": 900 } } }
  ],
  "styleVariants": [
    { "name": "bold", "colors": { "text": "#FFFFFF", "accent": "#F4C542" }, "fontFamily": "Inter, sans-serif" }
  ]
}
```

Note the 8-dimensional `embedding` here matches the dimensionality used by
`templates/quote/manifest.json` and `templates/image-panel/manifest.json` in
this project — match whatever dimensionality your actual embedding model
produces across *all* manifests, not specifically 8.
