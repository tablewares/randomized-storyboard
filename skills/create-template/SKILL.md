---
name: create-template
description: Create new Remotion templates for the randomized-storyboard pipeline. This skill contains all file requirements, schemas, conventions, and validation steps needed to add a new template from scratch with zero prior project knowledge.
---

# Create Template Skill

This skill provides everything a model with **zero prior knowledge** of the randomized-storyboard project needs to create a new template from scratch.

---

## Project Architecture Overview

The pipeline has **3 stages**:

1. **Pipeline 1** (`src/pipeline1/`) — Loads storyboard JSON, scores scenes against templates, computes frame timings
2. **Pipeline 2** (`src/pipeline2/`) — Seeded RNG + templating: picks layout/style variants, applies jitter, resolves assets
3. **Pipeline 3** (`src/pipeline3/`) — Remotion rendering: `VideoComposition` → `SceneRenderer` → template component

A **template** = a folder under `/templates/<template-key>/` containing:
- `manifest.json` — metadata, capacity, keywords, layout/style variants, asset slots
- `index.jsx` — React component (Remotion) that renders the hydrated layout payload

---

## Required Files

### 1. `templates/<template-key>/manifest.json`

```json
{
  "key": "your-template-key",              // MUST match folder name exactly
  "description": "Human-readable description for scoring engine",
  "capacity": { "minChars": 0, "maxChars": 200 },
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "maxLayoutJitterPx": 8,
  "assetSlots": {
    "slotName": "assets/default-filename.ext"
  },
  "layoutVariants": [
    {
      "name": "variant-name",
      "boundingBoxes": {
        "regionName": { "x": 0, "y": 0, "w": 1080, "h": 1920 }
      }
    }
  ],
  "styleVariants": [
    {
      "name": "variant-name",
      "colors": { "colorName": "#HEX" },
      "fontFamily": "Font Name, fallback"
    }
  ]
}
```

**Required fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `key` | string | ✅ | Must match folder name exactly (e.g., `title-card`) |
| `description` | string | ✅ | Used by scoring engine for keyword matching |
| `capacity` | object | ✅ | `minChars`/`maxChars` — scene text length must fall in this range for good score |
| `keywords` | string[] | ✅ | Used for keyword scoring (exact `type` match gets 0.35 weight) |
| `maxLayoutJitterPx` | number | ✅ | Max pixel jitter applied to bounding boxes (0 = none) |
| `assetSlots` | object | ✅ | Keys = slot names used in component; values = default asset paths under `templates/<key>/assets/` |
| `layoutVariants` | array | ✅ | At least 1 variant. Each has `name` + `boundingBoxes` object mapping region names → `{x,y,w,h}` |
| `styleVariants` | array | ✅ | At least 1 variant. Each has `name`, `colors` object, `fontFamily` string |

**Coordinate system:** Video is 1080×1920 (portrait). Origin (0,0) = top-left. All coords in pixels.

---

### 2. `templates/<template-key>/index.jsx`

```jsx
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, interpolate } from "remotion";

/**
 * <YourTemplateName> Template
 * Receives a fully hydrated layout payload from pipeline2/templating.js:
 *   {
 *     text: string,
 *     subtitle?: string,
 *     boundingBoxes: { regionName: {x,y,w,h}, ... },
 *     style: { colors: {...}, fontFamily: "..." },
 *     assets: { slotName: { url, source: "local"|"remote" }, ... },
 *     durationInFrames: number
 *   }
 */
export default function YourTemplateName({ layout }) {
  const frame = useCurrentFrame();
  const { boundingBoxes, style, assets, text, durationInFrames } = layout;

  // Standard fade-in / fade-out (15 frames each)
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const fadeOutStart = Math.max(durationInFrames - 15, 0);
  const fadeOutOpacity = interpolate(frame, [fadeOutStart, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const finalOpacity = Math.min(opacity, fadeOutOpacity);

  // Resolve asset URLs (handles local vs remote)
  const myAsset = assets.mySlotName;
  const assetUrl = myAsset?.url
    ? myAsset.source === "local"
      ? staticFile(myAsset.url)
      : myAsset.url
    : null;

  const isVideo = assetUrl?.toLowerCase?.().match(/\.(mp4|mov|webm|m4v)$/);

  return (
    <AbsoluteFill style={{ backgroundColor: style.colors?.background || "#000" }}>
      {/* Background asset */}
      {assetUrl && (
        isVideo ? (
          <OffthreadVideo src={assetUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={assetUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )
      )}

      {/* Text regions — use boundingBoxes from layout */}
      <div
        style={{
          position: "absolute",
          left: boundingBoxes.myRegion.x,
          top: boundingBoxes.myRegion.y,
          width: boundingBoxes.myRegion.w,
          height: boundingBoxes.myRegion.h,
          fontFamily: style.fontFamily,
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1.2,
          color: style.colors?.myColor,
          textShadow: `0 4px 24px ${style.colors?.shadow || "rgba(0,0,0,0.8)"}`,
          opacity: finalOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
```

**Required imports from Remotion:**
- `AbsoluteFill` — full-screen container
- `Img` — for images (handles local/remote)
- `OffthreadVideo` — for videos (timeout-safe)
- `staticFile` — resolves local asset paths for webpack
- `useCurrentFrame` — current frame number
- `interpolate` — smooth animations

**Component receives:** `{ layout }` — fully hydrated payload from pipeline2

**Layout payload structure:**
```js
{
  text: string,                    // scene.text from storyboard
  subtitle?: string,               // optional, scene.subtitle
  boundingBoxes: {                 // from chosen layoutVariant + jitter
    regionName: { x, y, w, h }
  },
  style: {                         // from chosen styleVariant + scene.styleOverrides
    colors: { colorName: "#HEX" },
    fontFamily: "Font Name"
  },
  assets: {                        // resolved from manifest.assetSlots + scene.media
    slotName: { url: "...", source: "local"|"remote" }
  },
  durationInFrames: number,        // from pipeline1 timing
  layoutVariant: "variant-name",   // chosen by RNG
  styleVariant: "variant-name",    // chosen by RNG
}
```

---

## Asset Handling

- **Local assets:** Place files in `templates/<key>/assets/` — reference in `manifest.json` as `"assets/filename.ext"`
- **Remote overrides:** In storyboard, provide `media: { slotName: "https://..." }` — source becomes `"remote"`
- **Video detection:** Check file extension (`.mp4`, `.mov`, `.webm`, `.m4v`) → use `<OffthreadVideo>` instead of `<Img>`
- **Local URL resolution:** `staticFile(asset.url)` in component (webpack resolves at bundle time)

---

## Registration (Required!)

After creating the two files, you **MUST** register the template in:

### `src/pipeline3/templateRegistry.js`

```js
import YourTemplate from "../../templates/your-template-key/index.jsx";

export const TEMPLATE_REGISTRY = {
  // ...existing entries...
  "your-template-key": YourTemplate,
};
```

**Without this registration, pipeline3 will throw:** `No registered component for template key "your-template-key"`

---

## Manifest Field Reference (Full)

| Field | Type | Description |
|-------|------|-------------|
| `key` | string | Unique identifier, must match folder name |
| `description` | string | Used for embedding/semantic scoring |
| `capacity.minChars` | number | Min text length for good score |
| `capacity.maxChars` | number | Max text length for good score |
| `keywords` | string[] | Keywords for keyword scoring (0.2 weight) |
| `maxLayoutJitterPx` | number | Random jitter applied to bounding boxes (0-12 typical) |
| `assetSlots` | object | Map of slotName → default asset path (relative to template folder) |
| `layoutVariants[]` | array | Each: `{ name, boundingBoxes: { region: {x,y,w,h} } }` |
| `styleVariants[]` | array | Each: `{ name, colors: {}, fontFamily }` |

**layoutVariants.boundingBoxes:** Keys become region names used in component (e.g., `title`, `subtitle`, `items`, `media`, `caption`, `text`)

**styleVariants.colors:** Keys become `style.colors.colorName` in component

---

## Storyboard Input (for testing)

Create a test storyboard at `storyboards/test-your-template.storyboard.json`:

```json
{
  "voiceConfig": { "voiceId": "narrator-1", "speed": 1 },
  "voiceoverSegments": [
    {
      "id": "s0",
      "type": "your-template-key",
      "text": "Your test text here"
    }
  ]
}
```
## File Tree After Creation

```
template_folder
├── assets
│   ├── bg-bullets.jpg
│   └── icon-bullet.png
├── index.jsx
└── manifest.json

```



Output: `out/MainVideo.mp4`

---

## Validation Checklist

Before considering a template "done", verify:

- [ ] Folder created at `templates/<key>/`
- [ ] `manifest.json` exists with all required fields
- [ ] `index.jsx` exists and exports default React component
- [ ] Component uses `layout.boundingBoxes`, `layout.style`, `layout.assets`, `layout.text`
- [ ] Component handles fade-in/out with `useCurrentFrame` + `interpolate`
- [ ] Asset resolution uses `staticFile` for local, direct URL for remote
- [ ] Video assets detected via extension and rendered with `<OffthreadVideo>`
- [ ] Template registered in `src/pipeline3/templateRegistry.js`
- [ ] At least 1 `layoutVariant` with `boundingBoxes` covering all regions used in component
- [ ] At least 1 `styleVariant` with `colors` and `fontFamily`
- [ ] `capacity.minChars`/`maxChars` realistic for template's text regions
- [ ] `keywords` include synonyms users might use as `type` in storyboard
- [ ] Test storyboard renders without errors (run render command above)
- [ ] Check `unmatched/unmatched_scenes_*.json` after render — your scene should NOT appear there (means it matched & rendered)

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Template key in manifest ≠ folder name | Must match exactly (case-sensitive) |
| Missing registration in templateRegistry.js | Add import + entry to TEMPLATE_REGISTRY |
| Component reads `layout.text` but manifest has no `text` region in boundingBoxes | Add region to layoutVariants.boundingBoxes |
| Asset not found at render time | Ensure default asset exists at `templates/<key>/assets/` path from manifest |
| Video plays as static image | Use `isVideo` check + `<OffthreadVideo>` |
| Text clipped/overflow | Increase boundingBox `h` or reduce `fontSize` |
| Scene falls to fallback template | Check `capacity` range includes your text length; check `keywords` match storyboard `type` |
| Webpack error on import | Ensure `templateRegistry.js` import path is correct relative path |

---

## Example: Creating a "Split-Screen" Template

```bash
mkdir -p templates/split-screen/assets
```

**manifest.json:**
```json
{
  "key": "split-screen",
  "description": "Two panels side by side or top/bottom with independent content",
  "capacity": { "minChars": 0, "maxChars": 200 },
  "keywords": ["split", "screen", "two-panel", "comparison", "versus", "side-by-side"],
  "maxLayoutJitterPx": 6,
  "assetSlots": {
    "leftMedia": "assets/split-left.jpg",
    "rightMedia": "assets/split-right.jpg"
  },
  "layoutVariants": [
    {
      "name": "horizontal",
      "boundingBoxes": {
        "leftTitle": { "x": 40, "y": 100, "w": 500, "h": 120 },
        "leftMedia": { "x": 40, "y": 250, "w": 500, "h": 700 },
        "leftText": { "x": 40, "y": 1000, "w": 500, "h": 500 },
        "rightTitle": { "x": 580, "y": 100, "w": 500, "h": 120 },
        "rightMedia": { "x": 580, "y": 250, "w": 500, "h": 700 },
        "rightText": { "x": 580, "y": 1000, "w": 500, "h": 500 }
      }
    },
    {
      "name": "vertical",
      "boundingBoxes": {
        "topTitle": { "x": 40, "y": 80, "w": 1000, "h": 100 },
        "topMedia": { "x": 40, "y": 200, "w": 1000, "h": 800 },
        "topText": { "x": 40, "y": 1050, "w": 1000, "h": 350 },
        "bottomTitle": { "x": 40, "y": 1450, "w": 1000, "h": 100 },
        "bottomMedia": { "x": 40, "y": 1570, "w": 1000, "h": 800 }
      }
    }
  ],
  "styleVariants": [
    {
      "name": "clean",
      "colors": { "background": "#0A0A0A", "title": "#FFFFFF", "text": "#CCCCCC", "divider": "#333333" },
      "fontFamily": "Inter, system-ui, sans-serif"
    }
  ]
}
```

**index.jsx:** (renders left/right or top/bottom panels using the boundingBoxes)

---


---

## Quick Test Checklist

```bash
# 1. Create template files
# 2. Register in templateRegistry.js
# 3. Create test storyboard
# 4. Run render
node src/pipeline3/render.js storyboards/test-your-template.storyboard.json

# 5. Verify output
ls -la out/MainVideo.mp4

# 6. Check unmatched log (should be empty or not contain your scene)
cat unmatched/unmatched_scenes_*.json
```

---

## Reference Files to Read

- `templates/title-card/manifest.json` + `index.jsx` — full-featured example
- `templates/bullet-list/manifest.json` + `index.jsx` — list parsing example
- `templates/image-panel/manifest.json` + `index.jsx` — video/image dual handling
- `templates/_fallback/manifest.json` + `index.jsx` — minimal template
- `src/pipeline3/templateRegistry.js` — registration pattern
- `src/pipeline2/templating.js` — hydration logic (what payload looks like)
- `skills/storyboard-json/references/schema.md` — full storyboard schema