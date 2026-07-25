# Storyboard Video Engine

A three-pipeline engine that turns an agent-authored storyboard JSON into a
rendered Remotion video: voiceover timing → template/variation selection →
content hydration → render with music/sfx. Templates are data (a manifest +
jsx structure files), discovered recursively, so adding a new template
family never touches engine code.

```
engine/
  contentKeys/registry.js     standardized content-key registry + validation/truncation
  random/seededRandom.js      deterministic PRNG, shared by all 3 pipelines
  templates/discovery.js      recursive manifest.json discovery -> TemplateRegistry
  scoring/
    templateScoring.js        weighted scene-vs-template scoring
    embeddings.js             pluggable embedder + cosine similarity, offline fallback
  pipeline1/
    voiceover.js               wraps the existing TTS+whisperX alignment function
    index.js                    timing + template selection + transitions
  pipeline2/
    styleMerge.js               deep-merge for style override layers
    index.js                    variation selection + content hydration
  pipeline3/
    sfxSelection.js             seeded sfx-per-scene selection
    index.js                    assembles RenderInput
    StoryboardVideo.jsx         Remotion composition (dynamic scene loading + transitions)
    RemotionRoot.jsx            Remotion entry point
    render.js                   bundle + renderMedia
orchestrator.js                 wires pipelines 1 -> 2 -> 3, writes debug artifacts
types.js                        shared contract types
templates/                      example template family (see "Templates" below)
examples/run-example.js         runnable end-to-end example (no Remotion needed)
```

Plain JS/JSX throughout, ES modules, no build step. Run the example with
just Node (v18+):

```bash
node examples/run-example.js
# or: npm run example
```

Rendering with Remotion requires additionally installing `remotion`,
`@remotion/bundler`, `@remotion/renderer`, `@remotion/transitions`, and
`react`/`react-dom` — these are intentionally not bundled here since this
deliverable focuses on the engine, not the render toolchain. `StoryboardVideo.jsx`
and `RemotionRoot.jsx` are consumed by Remotion's own bundler (esbuild under
the hood), which compiles JSX for you — no separate build step is needed on
this side either.

## 1. Content key registry (`engine/contentKeys/registry.js`)

This is the single vocabulary agents and templates share. An agent building
a storyboard only ever writes `content` using these keys:

```
title, subtitle, description, author, number, label, value,
quote, source, caption, date, items, tags, image, images, icon, video
```

Each key has a type (`string` / `richText` / `number` / `array` / `image`)
and a default max length/item-count. A template's manifest can tighten
those defaults (`maxChars`, `maxItems`) or mark a key `required`. Pipeline 2
validates every scene's content against the chosen template's declared
support: unsupported keys are dropped with a warning, values over the limit
are truncated, and missing required keys are logged. Add a new key here
first; templates opt in afterward — this is what lets an agent know the
full surface it can use without reading every template.

## 2. Templates: manifest + recursive discovery

A template is a folder containing `manifest.json` plus one or more
structure files (`.jsx`). Folders can nest arbitrarily —
`engine/templates/discovery.js` walks the whole tree and treats *any*
directory containing a `manifest.json` as a template, regardless of depth:

```
templates/
  lists/basic/manifest.json + structure1.jsx + structure2.jsx      -> lists/basic
  quote/pull-quote/manifest.json + structure1.jsx                  -> quote/pull-quote
  image-comparison/side-by-side/manifest.json + structure1.jsx     -> image-comparison/side-by-side
  lists/rankings/top-n/manifest.json + structure1.jsx              -> lists/rankings/top-n
```

`family` is every path segment between the templates root and the
template's own folder; `templateId` is `family/id`. This means you can
group related templates under a shared family folder at any depth without
the engine caring.

Manifest shape:

```jsonc
{
  "id": "basic",                     // optional, defaults to folder name
  "family": "lists",                 // informational; discovery derives the real one from path
  "description": "...",
  "keywords": ["list", "ranking", "top"],
  "supportedContentKeys": {
    "title": { "required": true, "maxChars": 50 },
    "items": { "required": true, "maxItems": 6 }
  },
  "variations": [
    {
      "id": "default",
      "structure": "structure1.jsx",   // resolved relative to the manifest's folder
      "animation": "stagger-fade-in",
      "style": { "palette": { "background": "#0b0b10", "accent": "#7c5cff" } }
    },
    {
      "id": "bold-numbered",
      "structure": "structure2.jsx",   // different structural/animation variation = different file
      "animation": "pop-in",
      "weight": 0.75                   // relative selection weight, default 1
    }
  ]
}
```

Discovery validates: every `variations[].structure` file exists on disk,
every `supportedContentKeys` entry is a real registry key, and there are no
duplicate variation ids or duplicate `templateId`s. Issues are collected
(not thrown) so a full catalog scan can report every problem at once — see
`template-discovery-issues.json` in orchestrator output.

Structure files (`.jsx`) receive `{ content, style, animation }` props and
own their own animation timing via Remotion's `useCurrentFrame`/`spring`
(see `templates/lists/basic/structure1.jsx` and `structure2.jsx` for the
reference contract — one family, two structurally different variations).

## 3. Pipeline 1 — timing + template selection (`engine/pipeline1`)

1. Concatenates scene voiceover strings in order and calls the
   already-implemented `ttsAlignFn(segments, voiceConfig)` (TTS synth +
   whisperX captioning + caption-to-segment matching). This engine treats
   that function as an injected dependency (`TtsAlignFn` in
   `pipeline1/voiceover.js`) — swap in the real implementation at the call
   site. It returns per-segment `{start, end}` seconds and the path to the
   one rendered audio file.
2. For every scene, scores every candidate template with
   `scoreSceneAgainstTemplate`, a weighted sum of:
   - **keyCoverage** — how much of the scene's content the template can
     actually use, and how much of what the template requires is present
     (two-directional, `DEFAULT_SCORING_WEIGHTS.keyCoverage = 0.4`)
   - **charFit** — for shared keys, whether content length fits the
     template's declared limit, decaying linearly past it (`0.25`)
   - **keyword** — scene `keywords[]` vs manifest `keywords[]`, either exact
     token-overlap (Jaccard, offline default) or cosine similarity via an
     injectable `EmbeddingProvider` (`0.25`)
   - **familyHint** — bonus if `scene.family` matches the template's family
     (`0.1`)

   Weights are overridable per run. If a scene sets `templateId` directly,
   scoring is skipped and that template is pinned; if it sets `family`,
   candidates are scoped to that family (falling back to the full catalog
   if the family has no templates).
3. If the best score is below `selectionThreshold` (default `0.5`), the
   best-scoring template is still used, but a structured warning is logged
   — `{sceneId, bestTemplateId, score, reason}` — naming the weakest scoring
   dimension so an agent knows *why* (e.g. "keyword 0.1, consider a new
   template with better keyword coverage") rather than just that it failed.
4. Transitions between consecutive scenes are picked from a general
   transition pool (`cut, fade, slide-left, slide-up, wipe, zoom-blend`)
   using an RNG derived from the master seed — same seed, same transitions,
   every run.

Output (`Pipeline1Output`): `audioPath`, `sceneTimings`, `templateSelections`
(one resolved templateId + score breakdown + transitions per scene), and
`warnings`. This fully resolves *which template* pipeline 2 needs, and
*when* each scene plays.

## 4. Pipeline 2 — variation + hydration (`engine/pipeline2`)

For each scene's resolved template:

1. Derives a **per-scene** RNG (`deriveRng(masterSeed, "variation", sceneId, templateId)`)
   and picks a variation via weighted random choice
   (`TemplateVariation.weight`, default 1). Deriving a sub-seed per scene
   (rather than pulling from one shared stream) means editing/adding scenes
   elsewhere doesn't reshuffle variation choices for untouched scenes.
2. Validates and truncates the scene's `content` against the chosen
   template's `supportedContentKeys`, using the shared content key registry
   (unsupported keys dropped, oversized strings truncated, both logged as
   `contentWarnings`).
3. Merges style: `variation.style` (template default) → `storyboard.globalStyle`
   (project-wide) → `scene.styleOverrides` (most specific), merged key-by-key
   so a scene can override just `palette.accent` without losing the rest of
   the template's palette.
4. Attaches the scene's timing from pipeline 1.

Output (`Pipeline2Output.hydratedScenes`): everything Remotion needs per
scene — absolute `structurePath`, final `content`, final `style`,
`animation`, and `timing`.

## 5. Pipeline 3 — render (`engine/pipeline3`)

1. `sfxSelection.js` lists audio files in `storyboard.sfxDir` and picks one
   per scene via `deriveRng(masterSeed, "sfx", sceneId)`, placed at that
   scene's `timing.endSec`.
2. `index.js` (`preparePipeline3`) assembles the final `RenderInput`: fps,
   total duration, the continuous voiceover `audioPath`, optional
   `music`, the resolved `sfx` placements, `scenes`, and `transitions`
   (derived from pipeline 1's per-pair transition choices).
3. `StoryboardVideo.jsx` is the actual Remotion composition: it lays out
   scenes in a `TransitionSeries`, dynamically `React.lazy`-loads each
   scene's structure component by its absolute path, overlays the one
   continuous voiceover `<Audio>` at frame 0, loops background music, and
   places one `<Audio>` sfx cue per scene at its end frame.
4. `render.js` bundles the project (`@remotion/bundler`) and renders an mp4
   (`@remotion/renderer`), passing the assembled `RenderInput` as
   `inputProps`.

## Putting it together

```js
import { runStoryboardEngine } from "./orchestrator.js";

await runStoryboardEngine({
  templatesRoot: "./templates",
  storyboard,               // agent-authored JSON, validated against types.js
  ttsAlignFn: myRealTtsAlignFn,
  outputDir: "./out",
  selectionThreshold: 0.55,
  // embedder: myEmbeddingProvider,  // optional, for cosine-similarity keyword matching
});
```

This writes `pipeline1-output.json`, `pipeline2-output.json`,
`render-input.json`, `template-selection-warnings.json` (only if any),
`template-discovery-issues.json` (only if any), and the final `.mp4` to
`outputDir` — the JSON artifacts double as the debugging/agent-feedback
trail for template scoring and content-truncation decisions.

## Determinism

Every random decision — transitions, variation choice, sfx choice — derives
from `storyboard.seed` via `deriveRng(seed, ...namespace)`
(`engine/random/seededRandom.js`), never from a shared/mutated global RNG.
Same seed and same storyboard always produce the same video; changing one
scene only reshuffles that scene's own derived streams, not unrelated
scenes.
