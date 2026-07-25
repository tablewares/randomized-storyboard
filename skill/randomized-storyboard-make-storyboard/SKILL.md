---
name: randomized-storyboard-make-storyboard
description: "Use when authoring a storyboard.json for the randomized-storyboard video engine (voiceover + scenes -> MP4). Produces a schema-valid storyboard for /home/tablewares/random/randomized-storyboard and runs pipelines 1-2 to verify template scoring/timing before full render."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [storyboard, video, remotion, randomized-storyboard, json, short-form]
    related_skills: [randomized-storyboard-make-template, randomized-storyboard-make-template-standalone]
---

# Make Storyboard (randomized-storyboard)

Author a `storyboard.json` that the `randomized-storyboard` engine can compile into a
vertical MP4 (1080×1920), then verify it scores against the existing template
catalog without doing a full Remotion render.

## Project root

All paths below are relative to **`/home/tablewares/random/randomized-storyboard`**.
The engine is plain Node.js + ESM (no build step). README.md and types.js are the
authoritative contract; this skill is a faster-to-load subset of those.

## When to use

- User asks for a storyboard / script / scene list for a short-form vertical video.
- User has source material (article, notes, transcript) and wants it turned into
  scene-by-scene voiceover + on-screen content for this engine.
- You already have a populated `templates/` folder and need to confirm a candidate
  storyboard actually matches real templates.

Do NOT use for: the sibling `agentic-storyboard` project (different layout —
`shortform-pipeline/compiler/`), or the older `src/`-layout skill of the same
name. This skill targets the current `engine/` layout on `main`.

## The storyboard schema (from types.js — ground truth)

```jsonc
{
  "id": "storyboard-1",                 // REQUIRED, used as the output filename
  "seed": "seed-42",                    // string|number. Master seed — ALL randomness
                                         //   (transitions, variation choice, sfx) derives
                                         //   from this. Same seed + same storyboard =
                                         //   identical MP4 every run.
  "voice": {                            // REQUIRED for real TTS (pipeline 1)
    "provider": "kyutai",               // informational; engine doesn't dispatch on it
    "voiceId": "george"                 //   — passed through to the TTS adapter as voice
  },
  "globalStyle": {                      // OPTIONAL — merged into every scene's style
    "palette": { "accent": "#00ffaa" },
    "font": { "scale": 1.05 }
  },
  "music": { "path": "music.mp4", "volume": 0.25 },  // OPTIONAL, filename in public/
  "sfxDir": "./assets/sfx",            // OPTIONAL, one sfx per scene end, seeded pick
  "fps": 30,                            // OPTIONAL, defaults to 30
  "scenes": [ /* see below */ ]
}
```

Each scene (from `StoryboardScene`):

```jsonc
{
  "id": "scene-1",                      // REQUIRED, unique
  "voiceover": "Here are the top three things you need to know.",  // REQUIRED
  "family": "lists",                    // OPTIONAL — restrict scoring to one family
  "templateId": "lists/basic",           // OPTIONAL — pin to one template, skips scoring.
                                         //   When set, `family` is implied and ignored.
  "keywords": ["top", "ranking"],       // OPTIONAL — matched against template.keywords[]
  "content": { /* StoryboardContent — see registry below */ },
  "styleOverrides": { /* OPTIONAL — deepest style layer, beats global + variation */ }
}
```

### The FIXED content-key registry

`content` may ONLY use keys from `engine/contentKeys/registry.js`. Any other key is
dropped with a warning during pipeline 2. This is the entire vocabulary:

| Key         | Type      | Default limit / notes |
|-------------|-----------|-----------------------|
| title       | string    | 60 chars |
| subtitle    | string    | 80 chars |
| description | richText  | 240 chars (body paragraph) |
| author      | string    | 40 chars |
| number      | number    | standalone stat/figure, no length limit |
| label       | string    | 20 chars |
| value       | string    | 20 chars (pairs with `label`) |
| quote       | richText  | 220 chars |
| source      | string    | 50 chars |
| caption     | string    | 100 chars |
| date        | string    | 30 chars |
| items       | array     | 8 items (list entries) |
| tags        | array     | 6 items (short keyword chips) |
| image       | image     | single image — `{ url, alt? }` |
| images      | array     | 4 items (e.g. comparisons) |
| icon        | image     | small icon |
| video       | image     | video src (url/path) |

A template's manifest can tighten these (`maxChars`/`maxItems`) or mark a key
`required`, but it can never invent new keys. So your `content` is always a subset
of this table — pick the 2–5 keys that match what the chosen template family renders
(`lists/basic` wants `title`+`items`; `quote/pull-quote` wants `quote`+`source`).

### Style surface (applies to `globalStyle` and per-scene `styleOverrides`)

```jsonc
{
  "palette": { "background", "foreground", "primary", "secondary", "accent", "muted" },
  "font":    { "heading", "body", "scale" },
  "spacing": { "scale" },
  "radius":  0
}
```

Merge order (later wins, key-by-key so `palette.accent` alone can be overridden):
`variation.style` (template default) → `storyboard.globalStyle` → `scene.styleOverrides`.

## How to author — numbered

1. **Decide scene count + family hints first.** Read the source material, pick
   3–8 scenes. For each scene, know which family it targets (`lists`, `quote`,
   anything you've added under `templates/<family>/`). Skip `family` to let the
   scorer pick freely; set `templateId` only when you must pin one.

2. **Write each scene's `voiceover` as the spoken line.** This is timing truth —
   pipeline 1 synthesizes all scenes' voiceover in order into ONE continuous MP3,
   then whisper-aligns word timestamps to recover each scene's `startSec`/`endSec`.
   Long lines = long scenes. Keep ≤ ~14 words/scene for snappy short-form.

3. **Pick `content` keys from the registry table above** that the chosen
   family actually renders. Drop anything you're unsure about — unsupported keys
   are silently truncated/dropped by pipeline 2, but clean input avoids
   `pipeline2-output.json` warnings.

4. **Leave `seed` as a short string** (e.g. `"seed-42"`). Change it to reshuffle
   variation picks, transition choices, and sfx — nothing else changes.

5. **Set `styleOverrides` only on specific scenes** (e.g. one scene with a
   different `palette.accent`). Project-wide theming goes in `globalStyle`.

6. **Run the validation script** (below). It exercises the real
   `engine/templates/discovery.js` + `runPipeline1` + `runPipeline2` so you catch
   template-miss warnings, content-truncation warnings, and discovery issues
   before any render. This is the completion gate — do not hand off the
   storyboard without a green run.

## Validation script (authoritative)

Save this as `references/score-storyboard.mjs` inside the skill (already created).
It imports the *real* engine modules and runs pipelines 1 + 2 end-to-end against
your storyboard, using the WPM fallback (no TTS server, no Whisper, no Remotion):

```bash
node ~/.hermes/skills/project/randomized-storyboard-make-storyboard/references/score-storyboard.mjs \
     /home/tablewares/random/randomized-storyboard/storyboard.json
```

A green run prints:
- `families: lists, quote (2 families)` (or whatever your catalog has)
- `scenes: <n> | warnings: <count>` — non-zero warnings means scenes are scoring
  below `selectionThreshold` or content got truncated. Read `pipeline2-output.json`
  for per-scene `contentWarnings`.
- exits 0. Any non-zero exit means the storyboard is not renderable in its current
  form and must be fixed.

The script resolves `templatesRoot` from `storyboard.config.json`
(`./templates`), so you don't pass it separately. If `storyboard.config.json` is
missing it falls back to `./templates` and `selectionThreshold: 0.4`.

## When you also need a render

After a green validation run, a real MP4 render needs the full TTS stack
(`engine/pipeline1/kyutai_tts.js` talks to `localhost:7000/tts` by default;
`whisperAlign.mjs` shells out to an alignment binary) AND Remotion + chromium.
Those are out of scope for this skill — hand off to the user for the render step,
or use the existing `randomized-storyboard` project skill for that path.

## Completion criteria

- [ ] `storyboard.json` has `id`, `seed`, `voice`, and a non-empty `scenes[]`.
- [ ] Every `scene.id` is unique; every `scene.voiceover` is a non-empty string.
- [ ] Every `scene.content` key is one of the 17 registry keys above.
- [ ] No `scene.templateId` is guessed — every value must appear in
  `template-discovery-issues.json` output (i.e. actually be a real templateId).
- [ ] `score-storyboard.mjs` exits 0 with the storyboard on disk.
- [ ] If warnings > 0, you've decided deliberately (logged the reason) or fixed them.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Scene has `family: "list"` (singular) | Families are plural from the folder path (`lists`, `quote`). Check `templates/`. |
| Content uses `subtitle` for a `quote` scene | Wrong family — `quote` renders `quote`+`source`, drops `subtitle`. Pick the family that supports what you wrote, or rewrite content. |
| `templateId: "basic"` (just the id) | `templateId` is `<family>/<id>`, e.g. `lists/basic`. `family` alone scopes; `templateId` pins exactly. |
| Last scene's voiceover is truncated in the MP4 | Out of scope for this skill (a pipeline-1 + audio tail-pad issue). Author with ≤ ~14 words/scene to sidestep. |
| `id` missing from root → output file is `undefined.mp4` | The engine uses `storyboard.id` as the MP4 filename. Always set `id`. |
| `content.tags` given non-array | Registry says `tags` is `array`; pipeline 2 will not coerce — it'll be dropped. |
| Template you reference isn't in `templates/` | Either add it (see `randomized-storyboard-make-template`) or remove `templateId` to let scoring pick. |

## What NOT to do

- Do NOT invent content keys outside the 17 in the registry — they are dropped.
- Do NOT set both `templateId` and `family` expecting both to apply — when
  `templateId` is set, scoring is skipped entirely.
- Do NOT write content for a template you haven't confirmed exists. Always run
  `node ~/.hermes/skills/project/randomized-storyboard-make-storyboard/references/list-templates.mjs`
  first if unsure.
- Do NOT edit `storyboard.config.json` from this skill — that's a render-config
  concern, owned by the user. Author the storyboard only.