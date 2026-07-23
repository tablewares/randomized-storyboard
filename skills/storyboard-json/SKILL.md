---
name: storyboard-json
description: Draft, validate, or convert content into a storyboard JSON file for this Remotion video-generation engine's render pipeline (consumed by renderVideoFromStoryboardFile / node src/pipeline3/render.js). Use this whenever the user wants to turn a script, outline, article, or list of talking points into scenes for a generated video, asks about "storyboard", "scene list", "voiceover segments", or wants input for the render function -- even if they don't name the JSON format explicitly.
---

# Storyboard JSON

A storyboard JSON file is the single input the render entrypoint needs. It
carries the voiceover script (as scenes) plus optional per-scene hints that
help Pipeline 1's scoring engine and Pipeline 2's hydration step do a better
job. Once written, it's rendered with:

```bash
node src/pipeline3/render.js path/to/my.storyboard.json [outputPath]
```

or from code:

```js
import { renderVideoFromStoryboardFile } from "./src/pipeline3/render.js";
await renderVideoFromStoryboardFile("path/to/my.storyboard.json");
```

## Minimal shape

```json
{
  "voiceConfig": { "voiceId": "narrator-1", "speed": 1 },
  "voiceoverSegments": [
    { "id": "s0", "type": "quote", "text": "The best way to predict the future is to invent it." },
    { "id": "s1", "type": "image-panel", "text": "A quiet morning by the lake." }
  ]
}
```

Every storyboard needs `voiceoverSegments` (non-empty array). Everything
else is optional and falls back to engine defaults (`src/config.js`).

For the full field-by-field reference (including `media`, `embedding`,
`styleOverrides`, and top-level `fps`/`width`/`height`/`outputPath`/
`masterSeed`), read **`references/schema.md`** before writing a non-trivial
storyboard. A ready-to-render example lives at
**`references/example.storyboard.json`**.

## Workflow

1. **Break the source content into scenes.** One `voiceoverSegments` entry
   per beat/shot, in the order they should appear. Keep each `text` roughly
   the length of what a template can actually hold -- see step 2.
2. **Look at what templates already exist** under `/templates` (read each
   `manifest.json`) before assigning a `type`. Pipeline 1 scores each scene
   against every template using: exact `type` == `manifest.key` match,
   whether `text.length` falls inside `manifest.capacity`, and (if you
   supply `embedding`) cosine similarity to `manifest.embedding`. You don't
   have to know the exact template roster to write a good storyboard --
   when unsure, leave `type` unset/`null` and let the scoring engine decide;
   just keep `text` reasonably concise so it fits *some* template's capacity
   band.
3. **Only set `media`/`styleOverrides` when you actually want to override
   the template's own default asset/style.** Templates already ship with
   local placeholder assets and multiple deterministic layout/style
   variants (picked by a seeded RNG, not randomly) -- most scenes need
   neither field.
4. **Validate before rendering.** `renderVideoFromStoryboardFile` (via
   `src/pipeline1/storyboard.js`) throws with a specific, per-field error
   message for: missing `voiceoverSegments`, a segment missing `id`/`text`,
   a non-array `embedding`, or a non-object `media`/`voiceConfig`. Read the
   error, fix that one field, retry -- don't guess at the whole schema again.
5. **Check `unmatched_scenes.json` after a render.** If a scene you expected
   to hit a nice template ended up on the primitive fallback, it's logged
   there with its scores. See the **`unmatched-template-builder`** skill to
   act on that file.

## Common mistakes

- Writing `type` values that don't match any `manifest.key` under
  `/templates` *and* expecting an exact-key match -- check the manifests
  first, or just omit `type`.
- Text far outside every template's `capacity.minChars`/`maxChars` -- the
  scene will still render (on the fallback template) but won't get the
  template you wanted. Split long scenes into two segments instead.
- Supplying an `embedding` with a different dimensionality than the
  templates' `manifest.embedding` vectors -- `cosineSimilarity` throws on a
  dimension mismatch rather than silently scoring 0. Only include
  `embedding` if you're generating it with the same embedding model/size
  used for the template manifests.
- Forgetting `media` URLs must be `http://`/`https://` to be treated as a
  remote override; anything else falls through to the template's local
  asset.
