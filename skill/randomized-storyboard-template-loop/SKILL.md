---
name: randomized-storyboard-template-loop
description: Loop skill for creating new templates in nested folder structures (template family -> specific template) and running validation for the randomized-storyboard pipeline.
category: project
tags:
  - remotion
  - template
  - video-generation
  - pipeline
  - short-form
  - automation
---

# Randomized Storyboard Template Loop Skill

## Purpose
Automates the creation of new Remotion templates in hierarchical folder structures (template family → specific template) and runs validation/registration for the randomized-storyboard pipeline.

## Project Context
This skill operates on `/home/tablewares/random/randomized-storyboard/` - a short-form vertical video pipeline with 3 stages:
1. **Pipeline 1** - Storyboard scoring & template matching (`src/pipeline1/`)
2. **Pipeline 2** - Seeded random templating & hydration (`src/pipeline2/`)
3. **Pipeline 3** - Remotion rendering (`src/pipeline3/`)

## Template Structure (Strict Hierarchy)

```
templates/
├── <template-family>/          # Family folder (e.g., anthropic-templates, educational-templates)
│   ├── <template-name>/        # Specific template folder
│   │   ├── manifest.json       # REQUIRED: key, description, capacity, keywords, layoutVariants, styleVariants, assetSlots, maxLayoutJitterPx
│   │   └── index.jsx           # REQUIRED: Remotion React component receiving `layout` prop
│   └── ...more templates...
├── _fallback/                  # Fallback template (always registered first)
└── templates-secondary/        # Secondary root (also scanned)
```

**Rule**: ALWAYS create templates in nested structure: `templates/<family>/<template>/`. Never create templates directly under `templates/`.

## Actual Project Manifest Schema (Discovered from Codebase)

The templates in this project use a **different schema** than typical Remotion templates:

```json
{
  "key": "comparison",
  "description": "Before/after or side-by-side comparison layout with metrics",
  "capacity": { "minChars": 30, "maxChars": 400 },
  "keywords": ["comparison", "before-after", "versus", "vs", "compare"],
  "maxLayoutJitterPx": 6,
  "assetSlots": {
    "beforeMedia": "assets/before.jpg",
    "afterMedia": "assets/after.jpg"
  },
  "layoutVariants": [
    {
      "name": "side-by-side",
      "boundingBoxes": { "title": { "x": 60, "y": 80, "w": 960, "h": 100 }, ... }
    },
    { "name": "stacked", "boundingBoxes": { ... } }
  ],
  "styleVariants": [
    { "name": "green-red", "colors": {...}, "fontFamily": "..." },
    { "name": "dark-contrast", "colors": {...}, "fontFamily": "..." }
  ]
}
```

**Key Differences from Standard Schema:**
- Uses `capacity` with `minChars`/`maxChars` (NOT `slots` array)
- Uses `keywords` array for template matching
- Uses `layoutVariants` with `boundingBoxes` for positioning
- Uses `styleVariants` with colors/fontFamily for theming
- Uses `assetSlots` for media references
- Uses `maxLayoutJitterPx` for layout randomization bounds

### index.jsx (Required) - Project Convention
Components receive a **`layout`** prop (not individual slots):

```jsx
import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export default function ComparisonTemplate({ layout }) {
  const frame = useCurrentFrame();
  const { boundingBoxes, style, assets, content, durationInFrames } = layout;
  
  // Animation logic using interpolate, useCurrentFrame
  // Render using boundingBoxes for absolute positioning
  // Apply style.colors, style.fontFamily from styleVariants
  // Use assets.beforeMedia, assets.afterMedia from assetSlots
  
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Position elements using boundingBoxes coordinates */}
    </AbsoluteFill>
  );
}
```

## Loop Workflow

### 1. Create Template Family (if not exists)
```bash
mkdir -p templates/<family-name>/
```

### 2. Create Specific Template
```bash
mkdir -p templates/<family-name>/<template-name>/
# Create manifest.json and index.jsx
```

### 3. Validate & Register (Run After Each Creation)
```bash
# Regenerate template registry (discovers all templates recursively)
node src/pipeline3/populateRegistry.js --regenerate

# List discovered templates
node src/pipeline3/populateRegistry.js --list

# Verify registration in generated registry
cat src/pipeline3/templateRegistry.js | grep "<family-name>-<template-name>"
```

### 4. Test Template Rendering
```bash
# Test with Remotion (dry run - validates component compiles)
npx remotion check src/pipeline3/Composition.jsx

# Test render a frame (requires storyboard with this template key)
node src/pipeline3/render.js storyboards/test-<template>.json test-output.mp4
```

## Automation Script Template

```javascript
// create-template-loop.js
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TEMPLATES_ROOT = "templates";
const FAMILIES = [
  "anthropic-templates",
  "educational-templates", 
  "social-media-templates",
  "bullet-list",
  "cta-outro",
  "image-panel",
  "quote",
  "stat-highlight",
  "title-card"
];

function createTemplate(family, name, manifest, componentCode) {
  const templateDir = path.join(TEMPLATES_ROOT, family, name);
  fs.mkdirSync(templateDir, { recursive: true });
  
  fs.writeFileSync(path.join(templateDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(templateDir, "index.jsx"), componentCode);
  
  console.log(`Created: ${templateDir}`);
}

function validateAndRegister() {
  console.log("Regenerating template registry...");
  execSync("node src/pipeline3/populateRegistry.js --regenerate", { stdio: "inherit" });
  
  console.log("Listing templates...");
  execSync("node src/pipeline3/populateRegistry.js --list", { stdio: "inherit" });
  
  console.log("Running Remotion type-check...");
  execSync("npx remotion compositions src/pipeline3/index.jsx", { stdio: "inherit" });
}

function testTemplate(templateKey, storyboardPath) {
  console.log(`Testing render for ${templateKey}...`);
  execSync(`node src/pipeline3/render.js ${storyboardPath} output/${templateKey}-test.mp4`, { stdio: "inherit" });
}

// Example loop with ACTUAL project schema
const templatesToCreate = [
  {
    family: "anthropic-templates",
    name: "new-comparison",
    manifest: { 
      key: "new-comparison", 
      description: "Side-by-side comparison layout", 
      capacity: { minChars: 200, maxChars: 800 },
      keywords: ["comparison", "vs", "versus"],
      maxLayoutJitterPx: 4,
      assetSlots: { beforeMedia: "assets/before.jpg", afterMedia: "assets/after.jpg" },
      layoutVariants: [{ name: "default", boundingBoxes: { title: { x: 60, y: 80, w: 960, h: 100 } } }],
      styleVariants: [{ name: "default", colors: { background: "#FFF" }, fontFamily: "Inter" }]
    },
    componentCode: `import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

export default function NewComparison({ layout }) {
  const frame = useCurrentFrame();
  const { boundingBoxes, style, assets, content, durationInFrames } = layout;
  // ... render logic using boundingBoxes for positioning
  return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
}`
  }
];

for (const t of templatesToCreate) {
  createTemplate(t.family, t.name, t.manifest, t.componentCode);
}

validateAndRegister();
```

## Validation Checklist (Run After Each Template)

- [ ] `manifest.json` exists with valid `key`, `capacity` (minChars/maxChars), `keywords`, `layoutVariants`, `styleVariants`, `assetSlots`, `maxLayoutJitterPx`
- [ ] `index.jsx` exports default React component
- [ ] Component accepts `layout` prop (destructures `boundingBoxes`, `style`, `assets`, `content`, `durationInFrames`)
- [ ] Component uses `useCurrentFrame` and/or `interpolate` for animations
- [ ] `node src/pipeline3/populateRegistry.js --regenerate` succeeds
- [ ] Template key appears in generated `templateRegistry.js` (prefixed with family)
- [ ] `npx remotion compositions src/pipeline3/index.jsx` passes (uses correct entry point with `registerRoot`)

## Common Pitfalls

| Issue | Fix |
|-------|-----|
| Template not in registry | Run `populateRegistry.js --regenerate`; check manifest.json has `key` |
| Remotion import error | Ensure `index.jsx` uses valid React/Remotion imports |
| Key collision | Keys prefixed with family; ensure unique within family |
| Style variants not working | Component must read `layout.style.colors`, `layout.style.fontFamily` |
| Scoring fails | Check `capacity.minChars/maxChars` matches expected content length |
| Layout broken | Verify `boundingBoxes` in layoutVariants match component expectations |
| Animation static | Use `useCurrentFrame` + `interpolate` for frame-based animations |
| Remotion check fails | Use `npx remotion compositions src/pipeline3/index.jsx` (not Composition.jsx) |
| **Remotion `staticFile()` rejects absolute paths** | **Copy audio/SFX/music to `public/` folder; reference by filename only in `StoryboardVideo.jsx`** |
| **Output video named `undefined.mp4`** | **Storyboard JSON must include `"id"` field (e.g., `"id": "storyboard-1"`)** |
| **Music/SFX not playing** | **Ensure files copied to `public/` and referenced correctly in `render-input.json`** |

## Key Commands Reference

```bash
# Discover & register all templates (recursive)
node src/pipeline3/populateRegistry.js --regenerate

# List discovered templates
node src/pipeline3/populateRegistry.js --list

# Validate Remotion compilation (CORRECT ENTRY POINT: index.jsx has registerRoot)
npx remotion compositions src/pipeline3/index.jsx

# Render test video from storyboard (uses --storyboard flag)
node src/pipeline3/render.js --storyboard <storyboard.json> --output <output.mp4>

# Full pipeline 1+2 (matching + templating)
node src/index.js <storyboard.json> [style-overrides.json]

# View generated registry
cat src/pipeline3/templateRegistry.js
```

## Skills Integration

This skill works with:
- `create-template` - For scaffolding new templates
- `storyboard-json` - For validating storyboard schema
- `agentic-storyboard` - For pipeline conventions (different project)

## Files to Monitor

| File | Purpose |
|------|---------|
| `src/pipeline3/populateRegistry.js` | Template discovery & registry generation |
| `src/pipeline3/templateRegistry.js` | Generated static registry (auto-generated) |
| `src/pipeline3/regenerate-registry.mjs` | ES module version |
| `src/pipeline3/render.js` | Video rendering entry (uses --storyboard flag) |
| `src/pipeline3/index.jsx` | **Remotion entry point with `registerRoot` (use for CLI checks)** |
| `templates/*/manifest.json` | Template manifests (actual schema with capacity/keywords/layoutVariants/styleVariants) |

## Support Files

- `references/validate-templates.js` - Standalone validation script matching actual project schema
- `references/template-loop.js` - Full lifecycle automation with CLI flags (--create, --validate, --test)