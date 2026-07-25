---
name: randomized-storyboard-make-template-standalone
description: "Use when a NON-AGENT LLM (no shell, no project access, can't run scripts) needs to author a visual template for the randomized-storyboard short-form video engine. Produces a manifest.json + one or more structure jsx files as text the user drops into a templates/<family>/<id>/ folder — no environment, no tool calls required."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [template, remotion, video, randomized-storyboard, llm, standalone]
    related_skills: [randomized-storyboard-make-template, randomized-storyboard-make-storyboard]
---

# Make Template — Standalone (no tool access)

This skill is for **LLMs that cannot read the project, run scripts, or know
which templates already exist**. The user will paste the entire output back into
their repo (drop into `templates/<family>/<id>/`); your job is to produce a
complete, drop-in template that the engine will accept and render with zero
edits.

If you ARE an agentic model with shell/file access, STOP and use the sibling
skill `randomized-storyboard-make-template` instead — it has live validation
scripts and ground-truth anchors this skill can't reach.

## What you produce (the ONLY two things the user needs from you)

1. **`manifest.json`** — one file, valid JSON, following the schema below exactly.
2. **One or more `structureN.jsx` files** — one per `variations[].structure`
   referenced in the manifest. Each is a single React component, default-exported.

Output ALL files verbatim in fenced code blocks stamped with the file path inside
the fence's info string where possible, e.g.:

````markdown
**`templates/<family>/<id>/manifest.json`**

```json
{ ... }
```

**`templates/<family>/<id>/structure1.jsx`**

```jsx
import React from "react";
// ...
```
````

Do NOT include prose between files beyond a single sentence saying what the
template renders. Do NOT include "next steps" or instructions to run anything.
The user will paste the files; the engine handles the rest.

## The manifest schema — copy this shape, fill it in

```jsonc
{
  "id": "my-template",                            // MANDATORY. Must match the folder name (case-sensitive).
  "family": "stats",                             // MANDATORY for your reference; engine ignores and derives it from the folder path.
  "description": "One sentence, what this template renders.",  // MANDATORY
  "keywords": ["stat", "number", "metric"],      // MANDATORY. 3-8 lowercase words authors might use as scene.keywords[]. Drives template matching scoring.
  "supportedContentKeys": {                      // MANDATORY, non-empty. Every key MUST be from the fixed registry below.
    "title":  { "required": true, "maxChars": 50 },
    "number": { "required": true },
    "label":  { "maxChars": 24 }
  },
  "variations": [                                // MANDATORY, non-empty, unique `id`s.
    {
      "id": "default",                            // MANDATORY. Unique within this template.
      "structure": "structure1.jsx",              // MANDATORY. Filename only, relative to the manifest's own folder.
      "animation": "fade-in",                     // OPTIONAL. Any string — passed as props.animation to the jsx, you read it in the component.
      "weight": 1,                                // OPTIONAL. Relative selection weight, default 1. Lower this to demote a variation.
      "style": {                                  // OPTIONAL. StandardStyleVars (see below).
        "palette": { "background": "#0b0b10", "foreground": "#f5f5f7", "accent": "#7c5cff" },
        "font":    { "heading": "Inter, system-ui, sans-serif", "body": "Inter, system-ui, sans-serif", "scale": 1 }
      }
    }
  ]
}
```

### The `style` object shape (StandardStyleVars)

```jsonc
{
  "palette": {
    "background": "#0b0b10",
    "foreground": "#f5f5f7",
    "primary": "#7c5cff",
    "secondary": "#00ffaa",
    "accent": "#ffcc00",
    "muted": "#888"
  },
  "font": {
    "heading": "Inter, system-ui, sans-serif",
    "body": "Inter, system-ui, sans-serif",
    "scale": 1.0
  },
  "spacing": { "scale": 1.0 },
  "radius": 0
}
```

All `style` keys optional; merge order at render time (later wins, nested-key by
key): `variation.style` (your default) → `storyboard.globalStyle` (project-wide)
→ `scene.styleOverrides` (most specific).

## The FIXED content-key registry — you can ONLY use these 17 keys

`supportedContentKeys` keys MUST be one of these. Any other key rejects the
manifest at discovery time (the engine throws `unknown content key`). Do NOT
invent keys; do NOT use plurals of these names ("titles", "quotes"). Pick the
ones your structure jsx actually reads.

| Key         | Type      | Default max | Use |
|-------------|-----------|-------------|-----|
| title       | string    | 60 chars    | Primary headline. |
| subtitle    | string    | 80 chars    | Secondary headline under the title. |
| description | richText  | 240 chars   | Body / paragraph copy. |
| author      | string    | 40 chars    | Attribution name (for testimonials, quotes). |
| number      | number    | (no limit)  | A standalone stat / figure (rank, percent, count). |
| label       | string    | 20 chars    | Short tag/badge text. Pairs with `value`. |
| value       | string    | 20 chars    | Short value paired with `label`. |
| quote       | richText  | 220 chars   | Quoted text (for quote-style templates). |
| source      | string    | 50 chars    | Citation / source for a quote or stat. |
| caption     | string    | 100 chars   | Short text describing an image/video. |
| date        | string    | 30 chars    | A date or date range string. |
| items       | array     | 8 items     | List entries (for list/ranking templates). |
| tags        | array     | 6 items     | Short keyword chips. |
| image       | image     | —           | Single image: `{ "url": "...", "alt": "..." }`. |
| images      | array     | 4 items     | Multiple images (e.g. comparisons). |
| icon        | image     | —           | A small iconographic image. |
| video       | image     | —           | A video source (`{ "url": "..." }`). The engine treats this like an image slot — your jsx can decide whether to render `<Img>` or `<OffthreadVideo>`. |

For each key in `supportedContentKeys`, you can set **none, any, or all** of:

```json
{
  "required": true,        // mark required if your jsx cannot render without it
  "maxChars": 50,         // tighten the default char limit (strings / richText)
  "maxItems": 4           // tighten the default item-count limit (arrays)
}
```

Skipping the constraints object entirely (`{}`) means "supported, with the
registry default." Marking `required: true` means pipeline 2 will warn (not
fail) if a scene is matched to this template without that key set — keep
required keys minimal so scenes have flexibility.

## The structure jsx contract (MANDATORY to follow exactly)

Each `variations[].structure` file is a **Remotion React component** receiving
exactly these three props:

```jsx
export default function YourVariantName({ content, style, animation }) {
  // content   — the validated/truncated StoryboardContent (only the keys you declared in supportedContentKeys)
  // style     — merged StandardStyleVars (variation.style + globalStyle + scene.styleOverrides)
  // animation — the string from variation.animation (use it to branch animation presets you support)
}
```

### Required imports (these are the only libraries available)

```jsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, OffthreadVideo, Sequence } from "remotion";
```

You may import from `@remotion/transitions/*` if you cross-fade internally, but
you should NOT need to — the outer `TransitionSeries` (controlled by the engine)
handles between-scene transitions for you. Do not import `react-router`,
`next/*`, CSS files, fonts via `@font-face`, or any other library — the engine
won't bundle them.

### Canvas

- **1080 × 1920 px portrait**.
- `<AbsoluteFill>` fills the whole canvas. Use absolute positioning, flex, or
  grid; inline styles only.
- The scene is wrapped by an outer `<TransitionSeries.Sequence>` whose
  `durationInFrames` is computed by the engine — you don't set it.

### Animation

The engine tells you WHEN you're on screen; you own HOW you animate within that:
- `const frame = useCurrentFrame();` — current frame (0-based, scene-local).
- `const { fps, durationInFrames } = useVideoConfig();` — if you need end-relative math.
- `interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" })` — fade-in.
- `spring({ frame, fps, config: { damping: 12 } })` — pop-in.
- `interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp" })` — fade-out (optional; the outer transition may handle this).

Use `props.animation` to branch between animation presets:

```jsx
const enter = animation === "pop-in"
  ? spring({ frame, fps, config: { damping: 12 } })
  : interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
```

### Reading content + style

```jsx
const { title, items = [], description, number, label } = content;
const palette = style.palette ?? {};
const fontScale = style.font?.scale ?? 1;
// palette.background, .foreground, .primary, .secondary, .accent, .muted
// style.font?.heading, style.font?.body, style.font.scale
// style.spacing?.scale, style.radius
```

Always use `??` defaults — pipeline 2 merges styles but a scene or storyboard
can omit any subset. Don't crash on missing keys.

### Asset handling (for `image`, `images`, `icon`, `video` keys)

When you declare `image` / `images` / `icon` / `video` in `supportedContentKeys`,
the value passed to your jsx is `{ url: "...", alt: "..." }` (or an array of
such for `images`). `url` is whatever the scene provided (a remote URL or a
filename the user will later place in the repo's `public/` folder). Render:

```jsx
import { Img, OffthreadVideo } from "remotion";

const isVideo = (u) => /\.(mp4|mov|webm|m4v)$/i.test(u ?? "");
// In JSX:
isVideo(content.image?.url)
  ? <OffthreadVideo src={content.image.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
  : <Img src={content.image.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
```

Do NOT call `staticFile()` yourself — pipeline 3's bridge resolves the asset
paths and only forwards scene-provided URLs to your jsx. `content.image.url`
will already be a value Remotion can serve.

### The default export MUST be a function

```jsx
export default function YourVariantName({ content, style, animation }) {
  return <AbsoluteFill>...</AbsoluteFill>;
}
```

If the engine can't `import default` from your file, the scene renders a
placeholder ("Missing template: ..."). No named exports, no `export const`.

## Authoring checklist (apply before you emit the files)

1. **`id` matches the folder name** the user will drop the files into. The final
   path is `templates/<family>/<id>/`, e.g. `templates/stats/big-number/`.
   - `<family>` (e.g., `stats`, `quote`, `lists`, `comparison`) is set by the
     user's folder hierarchy; the engine ignores the `family` field in your
     manifest and uses the folder path. Set `family` in the manifest for human
     readability only.
   - `<id>` MUST equal the leaf folder name, AND MUST equal manifest `id`. If
     the user names the folder `big-number`, your manifest `id` is `"big-number"`.

2. **`supportedContentKeys` only uses the 17 registry keys.** Re-read the table
   above. No plurals except `items` and `images` and `tags` (which ARE plurals in
   the registry). `subtitle` and `description` and `caption` are separate keys —
   don't substitute one for another.

3. **Declared keys = keys your jsx reads.** If you declare `icon` but your jsx
   never reads `content.icon`, that's a wasted declaration that may lock authors
   out of other templates. If your jsx reads `content.quote` but you forget to
   declare `quote`, pipeline 2 will DROPPED that key before your jsx ever sees
   it. The two must match exactly.

4. **Required keys are minimal.** `required: true` is a hard constraint that
   locks authors out of picking your template when they lack that key. Default to
   NOT making keys required unless your jsx genuinely cannot render (e.g. a quote
   template with no `quote` value has nothing to show — make `quote` required).

5. **`variations[].structure` filenames exactly match your emitted file names**,
   including the `.jsx` extension, with no folder prefix. The engine resolves
   them relative to the manifest's own folder — just `"structure1.jsx"`.

6. **One jsx file per variation id.** If two variations share a structure file,
   they'll render identically (only `animation`/`style` differ). That's almost
   never what you want. Each variation that should look different = its own file.

7. **`keywords` has at least 3 lowercase tokens, including synonyms**. Scene
   `keywords[]` are matched against your `keywords[]` for template scoring. A
   template with no keywords will never get picked over a template with matching
   ones. Include both the concept name and likely synonyms (`["stat", "metric",
   "number", "figure", "ranking"]`).

8. **Structure jsx uses only the allowed imports** and inline styles. No CSS
   files, no `@import`, no `@font-face`. Fonts are loaded via the OS; you can
   specify `fontFamily` in your `style.font.heading` and your inline `style`
   attribute, but you can't `@import` webfonts from the jsx.

9. **Component handles missing keys gracefully** (`const { title, items = [] } = content;`)
   so partial content doesn't crash the Remotion render.

10. **Canvas is 1080×1920 portrait.** Design for vertical phone video. Text sizes
    32–72 px for primary, 22–36 px for secondary. Don't shrink below 22 — at
    1080×1920 you have room, and tiny text illegible on phones.

## Reference — a complete minimal template

**`templates/lists/basic/manifest.json`**

```json
{
  "id": "basic",
  "family": "lists",
  "description": "A titled, numbered list of short items. Good for rankings, tips, and step lists.",
  "keywords": ["list", "ranking", "top", "steps", "tips", "countdown"],
  "supportedContentKeys": {
    "title":       { "required": true, "maxChars": 50 },
    "description": { "maxChars": 160 },
    "items":       { "required": true, "maxItems": 6 },
    "number":      {}
  },
  "variations": [
    {
      "id": "default",
      "structure": "structure1.jsx",
      "animation": "stagger-fade-in",
      "style": {
        "palette": { "background": "#0b0b10", "foreground": "#f5f5f7", "accent": "#7c5cff" },
        "font":    { "heading": "Inter, system-ui, sans-serif", "body": "Inter, system-ui, sans-serif", "scale": 1 }
      }
    }
  ]
}
```

**`templates/lists/basic/structure1.jsx`**

```jsx
import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export default function ListBasicDefault({ content, style }) {
  const frame = useCurrentFrame();
  const { title, description, items = [] } = content;
  const palette = style.palette ?? {};

  return (
    <AbsoluteFill
      style={{
        background: palette.background ?? "#0b0b10",
        color: palette.foreground ?? "#fff",
        padding: 80,
        fontFamily: style.font?.heading ?? "Inter, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 64 * (style.font?.scale ?? 1), margin: 0 }}>{title}</h1>
      {description && (
        <p style={{ fontSize: 28, opacity: 0.8, maxWidth: 800 }}>{description}</p>
      )}

      <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map((item, i) => {
          const delay = i * 6;
          const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const translateY = interpolate(frame - delay, [0, 15], [20, 0], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                opacity,
                transform: `translateY(${translateY}px)`,
                display: "flex",
                gap: 16,
                alignItems: "center",
              }}
            >
              <span style={{ color: palette.accent ?? "#7c5cff", fontSize: 32, fontWeight: 700 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 32 }}>{item}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
```

Note how the manifest's `supportedContentKeys` (`title`, `description`, `items`,
`number`) matches exactly the keys the jsx reads (`title`, `description`,
`items`). `number` is declared for authors who want to pass a list index but the
component doesn't read it — that's fine, getting declared-but-not-read is OK;
reading-but-not-declared is what breaks.

## Final emission — minimum viable output

For a simple one-variation template, the user receives exactly two fenced code
blocks from you:

1. **`templates/<family>/<id>/manifest.json`**
2. **`templates/<family>/<id>/structure1.jsx`** (or whatever your variation's
   `structure` is named)

If you offer multiple variations, emit one manifest + N structure files. Do not
emit any other files (no `index.jsx`, no `README.md`, no `package.json`, no
`assets/` directory). The user can paste them as-is. If they need image assets
they'll add an `assets/` folder themselves; the engine never requires it.

## Common pitfalls (check before you emit)

| Pitfall | Fix |
|---|---|
| Manifest `id` ≠ folder name | Set `id` exactly to the leaf folder name the user will use. |
| `supportedContentKeys` has a key not in the 17-key registry | Engine throws `unknown content key` at render; user's video fails. Pick only registry keys. |
| `variations[].structure` points to a file you didn't emit | Each variation's `structure` must be a filename you actually send. |
| Two variations share one structure file | They'll render identically — pointless. One jsx per visually distinct variation. |
| Structure jsx reads `content.foo` but `foo` isn't in `supportedContentKeys` | Pipeline 2 silently drops content keys the template doesn't declare; your jsx will get `undefined`. Declare every key you read. |
| Structure uses `staticFile()` or imports CSS | Neither is supported inside template structures. Use the asset URLs from `content.{image|video}.url` directly as the `src`. Inline styles only. |
| Component has a named export but no default export | Engine does `import Default from "<path>"` — no default means the scene gets a "Missing template" placeholder. Always `export default function ...`. |
| `keywords` missing or 1-2 tokens | Reduce the template's chance of being picked by the scorer. Always 3+ tokens with synonyms. |
| `required: true` on a key most scenes won't provide | Locks authors out. Required is for "absolutely cannot render without this." Mark only those. |
| Manifest uses old `key` / `capacity` / `layoutVariants` / `styleVariants` shape | Those are from a DIFFERENT project fork. THIS engine uses `id` / `family` / `supportedContentKeys` / `variations[].structure`. Follow the schema above. |

## What NOT to do

- Do NOT include prose explaining the project (the user already knows it).
- Do NOT include "Now put this in your templates folder" instructions —
  one sentence saying "drop these into `templates/<family>/<id>/`" is enough.
- Do NOT include scripts, commands, or "run this to verify" — you don't know
  what the user has installed.
- Do NOT reference file paths outside the template's own folder.
- Do NOT use TypeScript syntax (`interface`, `type`, generics) in the jsx
  unless you're sure the user's environment transpiles `.tsx` — emit `.jsx`
  and plain JS-only syntax (destructure with `??` defaults; no `as`).
- Do NOT make up a new content key because it sounds good — the engine rejects
  unknown keys hard. If you're unsure, use fewer keys, not more.