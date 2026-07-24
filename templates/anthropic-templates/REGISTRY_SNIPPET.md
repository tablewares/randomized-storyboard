# Registration

Add these two entries to `src/pipeline3/templateRegistry.js`:

```js
import StatHighlight from "../../templates/stat-highlight/index.jsx";
import CtaOutro from "../../templates/cta-outro/index.jsx";

export const TEMPLATE_REGISTRY = {
  // ...existing entries...
  "stat-highlight": StatHighlight,
  "cta-outro": CtaOutro,
};
```

# Assets note

Both manifests reference optional default assets (`assets/stat-bg.jpg`, `assets/wordmark.png`).
Both components null-guard on `assets.*` being absent, so they'll render fine without them —
but if you want the manifest's default to resolve, drop real files at:

- `templates/stat-highlight/assets/stat-bg.jpg`
- `templates/cta-outro/assets/wordmark.png` (ideally a transparent PNG wordmark)

# Test storyboards

```bash
node src/pipeline3/render.js storyboards/test-stat-highlight.storyboard.json
node src/pipeline3/render.js storyboards/test-cta-outro.storyboard.json
```
