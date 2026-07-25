# Style Modules Reference

Style modules provide template-specific computed styles during hydration. Each module receives `(scene, baseStyle, manifest)` and returns an override object that gets merged into the final layout style.

## Module Interface

```javascript
// src/pipeline2/styleModules/<templateKey>.js
export function applyStyleModule(scene, baseStyle, manifest) {
  // scene: hydrated scene object (with sceneIndex, text, durationInFrames, etc.)
  // baseStyle: the chosen styleVariant from manifest.styleVariants
  // manifest: the full template manifest.json
  
  return {
    // style overrides to merge into layout.style
    colors: { ... },
    fontSize: { ... },
    // ... any computed values
  };
}
```

## Current Modules

### `quote.js`
- **Dynamic font sizing**: Scales quote text size based on character count
- **Alternating quote marks**: Randomizes opening/closing quote characters per scene (", ", ", ", etc.)
- **Attribution styling**: Positions attribution below quote with appropriate spacing

### `image-panel.js`
- **Ken Burns params**: Computes deterministic zoom/pan parameters from scene RNG
- **Overlay opacity**: Dynamic overlay opacity based on image brightness heuristics
- **Caption layout**: Positions caption in safe zone (bottom third) with auto-sizing

### `title-card.js`
- **Dynamic title sizing**: Scales font size based on title length to prevent overflow
- **Subtitle handling**: Conditionally shows/hides subtitle bounding box based on content
- **Layout variant selection**: Can override layout variant based on content density

### `bullet-list.js`
- **Bullet point layout**: Computes Y positions for N bullet items with even spacing
- **Dynamic item count**: Handles 2-8 items with responsive font sizing
- **Marker styling**: Configures bullet marker (disc, dash, number) from style variant

### `stat-highlight.js`
- **Large number formatting**: Adds commas, abbreviates (K/M/B) for huge values
- **Unit positioning**: Positions unit (%, $, x) relative to value with proper spacing
- **Label hierarchy**: Styles eyebrow/label to support the main stat without competing

### `cta-outro.js`
- **Button styling**: Computes button dimensions, corner radius from style variant
- **CTA layout variants**: Supports centered, bottom-pinned, side-by-side layouts
- **Safe zone awareness**: Keeps CTA within TikTok/Reels safe zones

### `_fallback.js`
- **Primitive text card**: Minimal styling for unmatched scenes
- **Auto text wrapping**: Computes line height and max lines for bounding box

## Registration

Modules are registered in `src/pipeline2/styleModules.js`:

```javascript
import quoteModule from './styleModules/quote.js';
import imagePanelModule from './styleModules/image-panel.js';
// ...

export const STYLE_MODULE_REGISTRY = {
  'quote': quoteModule,
  'image-panel': imagePanelModule,
  // ...
};
```

## Adding a New Style Module

1. Create `src/pipeline2/styleModules/<templateKey>.js` with `applyStyleModule` export
2. Register in `src/pipeline2/styleModules.js`
3. The module will be automatically called during `hydrateScene()` for matching templates

## Invocation

In `src/pipeline2/templating.js` -> `hydrateScene()`:

```javascript
const styleModule = STYLE_MODULE_REGISTRY[templateKey];
const moduleOverrides = styleModule ? styleModule.applyStyleModule(scene, chosenStyle, manifest) : {};
const resolvedStyle = { ...chosenStyle, ...moduleOverrides, ...scene.styleOverrides };
```