# Dynamic Content Hydration

The pipeline now supports **arbitrary custom fields** in storyboard segments that flow through to template components.

## How It Works

### 1. Storyboard Authoring

Add any custom fields to a voiceover segment:

```json
{
  "voiceoverSegments": [
    {
      "id": "s0",
      "type": "title-card",
      "text": "5 Tips for Better Sleep",
      "subtitle": "Science-backed habits that actually work",
      "eyebrow": "HEALTH & WELLNESS"
    },
    {
      "id": "s1", 
      "type": "quote",
      "text": "Sleep is the single most effective thing we can do to reset our brain and body health each day.",
      "attribution": "— Matthew Walker, PhD"
    },
    {
      "id": "s2",
      "type": "bullet-list",
      "text": "Three pillars of sleep hygiene",
      "title": "Core Principles",
      "items": [
        "Cool room (65-68°F)",
        "No screens 1hr before bed",
        "Consistent wake time"
      ]
    }
  ]
}
```

### 2. Pipeline 1 Pass-Through

`src/existing/getSceneTimings.js` now uses spread syntax (`...segment`) to preserve all fields:

```javascript
// Both TTS+Whisper path and WPM fallback path
return segments.map(segment => ({
  ...segment,  // <-- preserves subtitle, attribution, title, items, etc.
  start: ...,
  end: ...,
  ...
}));
```

### 3. Pipeline 2 Hydration

`src/pipeline2/templating.js` -> `hydrateScene()` collects all non-metadata fields:

```javascript
const METADATA_FIELDS = new Set([
  "id", "sceneIndex", "type", "text", "startFrame", "endFrame", 
  "durationInFrames", "fps", "embedding", "keywords", "media", 
  "styleOverrides", "matchedTemplate", "matchScore", "matchBreakdown", "matchSource"
]);

const dynamicContent = {};
for (const [k, v] of Object.entries(scene)) {
  if (!METADATA_FIELDS.has(k) && v !== undefined) {
    dynamicContent[k] = v;
  }
}

// Passed to template via layout.content
layout.content = dynamicContent;
```

### 4. Template Access

Template components receive `layout.content`:

```jsx
// templates/title-card/index.jsx
export default function TitleCardTemplate({ layout }) {
  const { title, subtitle, eyebrow } = layout.content;
  return (
    <>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.title}>{title || layout.text}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </>
  );
}
```

## Currently Used Fields by Template

| Template | Fields from `layout.content` |
|----------|------------------------------|
| `title-card` | `subtitle`, `eyebrow` |
| `quote` | `attribution` |
| `bullet-list` | `title`, `items[]` |
| `image-panel` | `caption` |
| `stat-highlight` | `eyebrow`, `value`, `unit`, `label` (from manifest capacity) |
| `cta-outro` | `headline`, `subtext`, `buttonLabel` |

## Adding New Fields

1. **Add to storyboard JSON** — any field name not in `METADATA_FIELDS`
2. **Update template component** — read from `layout.content.yourField`
3. **No pipeline changes needed** — automatic pass-through

## Benefits

- **Schema-free** — no need to update validation for new content types
- **Template-specific** — each template only uses fields it cares about
- **Backwards compatible** — existing storyboards work unchanged
- **TypeScript friendly** — can define `content` shape per template