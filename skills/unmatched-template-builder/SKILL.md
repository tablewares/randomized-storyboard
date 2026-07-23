---
name: unmatched-template-builder
description: Review this Remotion video engine's unmatched_scenes.json (scenes that scored below THRESHOLD against every template and fell back to the primitive template) and close the gap by extending an existing template or building a brand-new one. Use this whenever the user asks to look at unmatched scenes, wants to improve template coverage/match rate, asks why a scene rendered as a plain fallback card, or wants to add/design a new Remotion template for this engine.
---

# Unmatched-Scene Template Builder

`unmatched_scenes.json` (project root, path is `config.UNMATCHED_LOG_PATH`) is
Pipeline 1's paper trail: every scene that scored below `THRESHOLD` against
*every* template in `/templates` and `/templates-secondary`, before being
assigned the primitive `_fallback` template. This skill turns that file into
new/improved templates.

**The log is append-only** (`appendJsonLog` in `src/utils/fsHelpers.js`) —
entries from old runs persist. Delete or archive it before a clean re-test
run so you're only looking at current failures.

## Step 1 — Triage

Run the bundled script instead of eyeballing the raw JSON:

```bash
node skills/unmatched-template-builder/scripts/summarize_unmatched.js
```

It groups records by their closest-but-still-failing primary template and
prints, per scene: the composite score vs `THRESHOLD`, and which signal(s)
dragged it down —
- **no exact key match** — the scene's `type` didn't equal any `manifest.key`
- **char count outside capacity band** — `text.length` was outside that
  template's `manifest.capacity.minChars`/`maxChars`
- **low semantic similarity** — cosine score against `manifest.embedding`
  was weak (only meaningful if the scene actually supplied an `embedding`;
  a missing embedding always scores 0 here, which is expected, not a bug)

(Pass a path as the first arg to point it at a different log file.)

## Step 2 — Decide: extend or create

- **Extend an existing template** if the grouped scenes are a reasonable
  fit for it, just outside its current envelope — e.g. text a bit longer
  than `capacity.maxChars`, or a legitimate new `type` alias for the same
  visual layout. Widen `capacity`, add a `layoutVariants`/`styleVariants`
  entry, or adjust `embedding` in that template's `manifest.json`.
- **Create a new template** if the grouped scenes represent a genuinely
  different visual treatment none of the existing templates should be
  stretched to cover. Read `references/manifest-schema.md` for the full
  manifest field reference, then follow the checklist below.

## Step 3 — New template checklist

1. **Folder**: `templates/<new-key>/` (or under `templates-secondary/` if
   it should only be tried after the primary root misses) containing:
   - `manifest.json`
   - `index.jsx`
   - `assets/` (real files — an empty/missing `assets` dir fails the
     template-folder validity check in `src/utils/fsHelpers.js` and the
     template will be silently skipped)
2. **`manifest.json`**: give it a `key` distinct from every existing
   template (matching the scenes' `type` field, if they reliably use one).
   Set `capacity.minChars`/`maxChars` from the actual char counts you saw
   in the unmatched group. If you're supplying `embedding`, it **must be
   the same length** as every other template's embedding vector —
   `cosineSimilarity` throws on a dimension mismatch, it doesn't degrade
   gracefully. Define at least one `layoutVariants` and `styleVariants`
   entry, and `assetSlots` for anything the component needs to render.
3. **`index.jsx`**: a React component receiving `{ layout }` (see any
   existing template for the shape: `layout.text`, `layout.boundingBoxes`,
   `layout.style`, `layout.assets`). Use Remotion's `<Img />` and
   `<OffthreadVideo />` (never plain `<img>`/`<video>`) for every
   remote/local asset, and `staticFile()` for local asset paths — see
   `templates/quote/index.jsx` or `templates/image-panel/index.jsx` for
   the pattern.
4. **Register it**: add one line to `src/pipeline3/templateRegistry.js`
   mapping the new `key` to the component. Remotion's webpack bundler needs
   a static import graph — a template that scores perfectly in Pipeline 1
   but isn't registered here will throw
   `No registered component for template key "..."` at render time.
5. **Re-test**: clear `unmatched_scenes.json`, re-run the render (or just
   `runPipelinesOneAndTwo` for a quick check without a full video render),
   and confirm the previously-unmatched scenes now score above `THRESHOLD`
   and no longer appear in the log.

## Gotchas

- Don't raise `THRESHOLD` (`src/config.js`) to "fix" unmatched scenes —
  that's a global knob that changes matching for every scene, not a
  per-template fix.
- A template can exist and score well but still fail at render time if it's
  missing from `templateRegistry.js` — always do the registration step.
- Keep `SCORING_WEIGHTS` (`src/config.js`) in mind when reading scores: by
  default exact-key match is worth the most (0.4), then cosine similarity
  (0.35), then capacity fit (0.25) — so a scene missing only the `type`
  match can still clear `THRESHOLD` (0.62 by default) on capacity + cosine
  alone if both are strong.
