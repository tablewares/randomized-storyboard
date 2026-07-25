---
name: randomized-storyboard-make-template
description: "Use when adding a new visual template to the randomized-storyboard engine (/home/tablewares/random/randomized-storyboard). Creates a template folder (manifest.json + one or more structure jsx files) under templates/<family>/<id>/ and validates it against the real discoverTemplates() + content-key registry."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [template, remotion, video, randomized-storyboard, jsx]
    related_skills: [randomized-storyboard-make-storyboard, randomized-storyboard-make-template-standalone]
---

# Make Template (randomized-storyboard)

Create a new visual template for the `randomized-storyboard` engine's template
catalog, then validate it against the real discovery + content-key machinery the
engine runs at render time. This skill produces a template the orchestrator can
match against storyboard scenes with zero engine code edits.

## Project root

All paths below are relative to **`/home/tablewares/random/randomized-storyboard`**.
The engine source lives in `engine/`; the template catalog lives in `templates/`.

## What a "template" is (in this engine)

A template is a **folder** on disk containing:

```
templates/<family>/<id>/
├── manifest.json       # REQUIRED — metadata + supportedContentKeys + variations[]
├── structure1.jsx      # REQUIRED — at least one structure file referenced by a variation
├── structure2.jsx      # OPTIONAL — additional variations reference different files
└── ...                 # no other files are read by discovery
```

Discovery (`engine/templates/discovery.js`) walks `templates/` recursively.
**Any directory containing `manifest.json` is a template**, regardless of nesting
depth. The `family` is every path segment between `templatesRoot` and the
template's own folder (so `templates/lists/basic/` has family=`lists`,
templateId=`lists/basic`). `templates/lists/ranked/top-n/` has family=`lists/ranked`,
templateId=`lists/ranked/top-n`.

Key implication: this is **NOT** the older `src/`-layout skill of the same name.
The current schema uses `supportedContentKeys` + `variations[].structure`, not
`key`/`capacity`/`layoutVariants`. Follow THIS skill's schema, not the old one.

## The manifest schema (from types.js + discovery.js)

```jsonc
{
  "id": "basic",                        // OPTIONAL — defaults to the folder name. Must be unique within its family.
  "family": "lists",                    // OPTIONAL — set by discovery from path; declaring it is informational only.
  "description": "Human-readable. Used by agents reading the catalog; not used for scoring.",
  "keywords": ["list", "ranking", "top", "steps"],  // OPTIONAL — token-overlap match against scene.keywords[]
  "supportedContentKeys": {             // REQUIRED, must be non-empty, every key must exist in the registry (see below)
    "title":     { "required": true, "maxChars": 50 },
    "items":     { "required": true, "maxItems": 6 },
    "description": { "maxChars": 160 },           // optional keys: no `required` => defaults to false
    "number":    {}                                // supported but no tight limits
  },
  "variations": [                       // REQUIRED, non-empty, unique `id`s
    {
      "id": "default",
      "structure": "structure1.jsx",    // REQUIRED — path to the .jsx file, relative to the manifest's folder
      "animation": "stagger-fade-in",   // OPTIONAL — string passed to the structure jsx as props.animation
      "weight": 0.75,                   // OPTIONAL — relative selection weight within this template, default 1
      "style": {                        // OPTIONAL — StandardStyleVars; merged with storyboard.globalStyle + scene.styleOverrides
        "palette": { "background": "#0b0b10", "foreground": "#f5f5f7", "accent": "#7c5cff" },
        "font":    { "heading": "Inter", "body": "Inter", "scale": 1 }
      }
    },
    {
      "id": "bold-numbered",
      "structure": "structure2.jsx",    // DIFFERENT structure file = different visual/animation
      "animation": "pop-in",
      "weight": 0.75
    }
  ]
}
```

### Discovery validation rules (engine/templates/discovery.js)

These are checked at render time and surface as `template-discovery-issues.json`:
- `variations` is non-empty.
- `supportedContentKeys` is non-empty.
- Every key in `supportedContentKeys` exists in `engine/contentKeys/registry.js`
  (see the fixed list below). Unknown keys are REJECTED.
- `variations[].structure` files exist on disk (relative to the manifest's folder).
- No duplicate `variations[].id`.
- No duplicate `templateId` across the catalog.

### The content-key registry (engine/contentKeys/registry.js — fixed)

`supportedContentKeys` keys **must** be one of:

```
title, subtitle, description, author, number, label, value,
quote, source, caption, date, items, tags, image, images, icon, video
```

Each registry key carries a `type` and a default max length/item-count. The
manifest can tighten (`maxChars`, `maxItems`) or mark `required: true`, but
cannot invent new keys. Pipeline 2 validates every scene's content against the
chosen template's declared support: unsupported keys are silently dropped,
oversized strings truncated, missing required keys logged.

### Style surface (StandardStyleVars — used by `variations[].style`)

```jsonc
{
  "palette": { "background", "foreground", "primary", "secondary", "accent", "muted" },
  "font":    { "heading", "body", "scale" },
  "spacing": { "scale" },
  "radius":  0
}
```

Merge order at render time (later wins, key-by-key): `variation.style`
(template default) → `storyboard.globalStyle` → `scene.styleOverrides`.

## The structure file contract (REQUIRED — read this carefully)

Each `variations[].structure` jsx file is a **Remotion React component** that
receives three props:

```jsx
export default function MyStructure({ content, style, animation }) {
  // content  — validated/truncated StoryboardContent (the keys declared in supportedContentKeys)
  // style    — merged StandardStyleVars (variation.style + globalStyle + scene.styleOverrides)
  // animation— the string from variation.animation (use it to branch animation presets)
}
```

**Reality check — the structures copied into Remotion at render time:**
`engine/pipeline3/copyStructures.js` copies every `structure*.jsx` from every
discovered template into `public/structures/<family>-<templateId>-<structurefile>`
and regenerates `engine/pipeline3/Structures.jsx` with static ES-module imports
of those copies. `StoryboardVideo.jsx` looks up structure components by the
composite key `<family>-<id>-<structurefile>` (where `family` has `/` replaced by `-`).
So **no manual registration step** — drop the files into `templates/<family>/<id>/`
and discovery + copyStructures do the rest at the next render. The composite
key is what pipeline3's render passes to the Bridge.

**Required imports** (look at `templates/lists/basic/structure1.jsx` for the
reference contract):

```jsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";

export default function MyStructure({ content, style }) {
  const frame = useCurrentFrame();
  const { title, items = [], description } = content; // content keys declared in manifest
  const palette = style.palette ?? {};
  // ... use interpolate(frame, [0,15], [0,1], { extrapolateRight: "clamp" }) for fade-in
  // ... use spring({ frame, fps, config: {...} }) for pop-in
  // ... use palette.background, palette.foreground, palette.accent from style.palette
  // ... use style.font?.heading, style.font?.scale for type
  return <AbsoluteFill style={{ background: palette.background ?? "#000" }}>...</AbsoluteFill>;
}
```

- Canvas is **1080 × 1920** (portrait). Use absolute positioning or flex; you don't
  have to fill the canvas — `AbsoluteFill` is a helper, not a constraint. The
  `TransitionSeries.Sequence` outside wraps you with the scene's durationInFrames.
- Structures own their own animation timing via `useCurrentFrame()`; the engine
  only tells them *when* they're on screen (via the outer Sequence), not how to
  animate internally.
- The first scene starts cold; transitions between scenes (`cut`, `fade`,
  `slide-left`, `slide-up`, `wipe`, `zoom-blend`) are picked from the master seed
  and rendered by the outer `TransitionSeries`.

## How to author — numbered

1. **Decide `<family>/<id>` for the new template.** `family` should be plural and
   match an existing folder if you're adding to one (`lists`, `quote`), or a new
   top-level category (`stats`, `comparison`, `agenda`). `id` is the leaf folder.

   ```bash
   mkdir -p templates/<family>/<id>/
   ```

2. **Pick 1–3 variations.** Each variation is a distinct visual/animation of the
   same content contract. More variations = more RNG variety at render time.
   Each variation gets its own `structureN.jsx` file (don't reuse the same file
   for two variation ids — the engine reads `variations[].structure` as the file
   path, so two variations pointing at one file will render identically).

3. **Write `manifest.json`** with `supportedContentKeys` chosen from the 17-key
   registry above. Mark the keys your structure **must** have as `required: true`.
   Include at least 3 `keywords` (synonyms users might use as scene `keywords[]`).

4. **Write each `structureN.jsx`** as a Remotion component reading from
   `props.content` and `props.style`. Read the contract above. Use
   `useCurrentFrame()` for animation. Don't import css — inline styles only.

5. **Run the validation script** (below). It calls `discoverTemplates()` for real
   and reports any issues against your new manifest. It also catches missing
   structure files, unknown content keys, duplicate variation ids, and broken
   JSX imports (by attempting to dynamically import each structure component).

6. **Smoke-test against a storyboard.** Create a 2-scene storyboard.json that
   uses `templateId: "<family>/<id>"` and run the storyboard-scoring script from
   the sibling skill (`randomized-storyboard-make-storyboard`). It will score
   your new template end-to-end through pipelines 1 + 2 and report whether
   pipeline 2 accepted your content shape (or silently truncated it).

## Validation script (authoritative)

```bash
# Validates ONE new template folder (or every template) against discovery rules
# + content-key registry + JSX dynamic import (best-effort, no Remotion runtime):
node ~/.hermes/skills/project/randomized-storyboard-make-template/references/validate-template.mjs templates/<family>/<id>/
# Or leave the path off to scan the entire catalog:
node ~/.hermes/skills/project/randomized-storyboard-make-template/references/validate-template.mjs
```

A green run prints:
- `template: <family>/<id> — OK` for each template that passed
- `issues: 0` total
- Exit 0 if every template passed; exit 1 if ANY discovered template had issues.

A red run lists specific issues (`unknown content key`, `missing structure file`,
`duplicate variation id`, `manifest zero variations`) — read the messages, fix
the manifest, re-run. Issues are COLLECTED not thrown, so you'll see every
problem at once.

## Run template folder structure AFTER creation

```
templates/<family>/<id>/
├── manifest.json
├── structure1.jsx          # referenced by variations[0].structure
├── structure2.jsx          # OPTIONAL, for additional variations
└── ...                     # additional files (e.g. README.md) are ignored by discovery
```

No registry files to touch, no `populateRegistry.js` step, no template-mapping
.register. Discovery + copyStructures wiring handle every template they find.

## Completion criteria

- [ ] `templates/<family>/<id>/manifest.json` exists and parses as JSON.
- [ ] Every key in `supportedContentKeys` is one of the 17 registry keys.
- [ ] Every `variations[].structure` file exists at the path declared (relative
  to the manifest's own folder).
- [ ] All `variations[].id` are unique.
- [ ] `validate-template.mjs templates/<family>/<id>/` exits 0 with issues: 0.
- [ ] A 1–2 scene storyboard using `templateId: "<family>/<id>"` passes the
  sibling skill's `score-storyboard.mjs` with `warnings: 0`.
- [ ] Each structure jsx accepts `{ content, style, animation }` and renders to
  `<AbsoluteFill>` with no React import errors.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Manifest uses `key`/`capacity`/`layoutVariants` schema | That's the OLD profile (different project fork). THIS engine uses `id`/`family`/`supportedContentKeys`/`variations[].structure`. See `templates/lists/basic/manifest.json` for ground truth. |
| `supportedContentKeys` includes a non-registry key | Discovery will fail validation with `unknown key "X" — not in the standardized content key registry`. Use only the 17 keys listed above. Add new keys to `engine/contentKeys/registry.js` first (out of scope for this skill). |
| `variations[].structure` path is wrong | It's relative to the MANIFEST'S folder, not to `templates/`. So if both files sit next to each other, just the filename `"structure1.jsx"` is correct. |
| Two variations point at the same `structure` file | They'll render identically — variation choice then only changes `style`/`animation` from the manifest. That's rarely what you want. Give each variation its own file. |
| Structure jsx imports from `react-router`, `next/*`, or other libs | Those aren't bundled; only `react`, `remotion`, and `@remotion/transitions/*` are available at render time. Stick to inline styles and standard React + Remotion primitives. |
| Structure jsx uses `useVideoConfig`'s `durationInFrames` to animate | The outer `TransitionSeries.Sequence` already bounds duration; if your structure depends on knowing its end frame, use `useCurrentFrame()` and `math` against `durationInFrames` — but for fade-out, either omit it (the outer transition handles it) or compute from `useVideoConfig().durationInFrames`. |
| Folder name doesn't match `manifest.id` | Not a bug — `id` defaults to the folder name, but if you want a different public id, set `manifest.id` explicitly. The folder name alone determines nothing else. |
| Template nested under another template | Discovery STOPS descending once it finds a `manifest.json` in a folder. So `templates/parts/header/manifest.json` inside a `header/` folder with its own manifest will be discovered, but you can't nest a manifest inside a template's own folder. |

## What NOT to do

- Do NOT register templates in any "registry" file — the engine uses
  `discoverTemplates()` at orchestrator time and `copyStructures.js` at render
  time. Old skill prose referencing `src/pipeline3/populateRegistry.js` is stale
  (that file doesn't exist in this codebase).
- Do NOT edit `engine/contentKeys/registry.js` from this skill — adding a new
  content key is a separate task that affects every template and the agent
  contract. Stay within the 17 existing keys; if you genuinely need a new one,
  ask the user.
- Do NOT put CSS files or external stylesheets in the template folder — only
  inline styles render through Remotion's bundler in this project.
- Do NOT use a bare component name as `variations[].structure` — it MUST be a
  path to an actual `.jsx` file on disk relative to the manifest's folder.