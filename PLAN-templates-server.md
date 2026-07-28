# Plan: Local preview server for templates/ folder

Goal: dev server browses every discovered template, renders each variation standalone (no full pipeline), uses default hydration values for content keys. Lives outside the Remotion render path so no bundler/renderer dependency.

## Background — what already exists

- `engine/templates/discovery.js` walks `templates/**/manifest.json` → registry of `{ templateId, family, variations[] }`. Each variation has `structure` (rel .jsx), `animation`, `style` (palette/font).
- `engine/contentKeys/registry.js` exports `CONTENT_KEY_REGISTRY` (type + description per key) and `validateAndTruncateContent(content, supported)`. No default value fields — components destructure with `??` fallbacks (`items = []`, etc.).
- Structure components share one prop contract: `props = { content, style, animation }` (`style` = `variation.style`; `content` = per-key values).
- Render path (skip it): `engine/pipeline3/*` uses `@remotion/bundler` + `renderMedia` → heavy, needs chromium. Server must NOT reuse render path.

## Default hydration values

No `default` field in manifests or registry. Derive defaults per key from `CONTENT_KEY_REGISTRY.type` + manifest's `supportedContentKeys`:

| type | default |
|---|---|
| string / richText | `"<Key>"` (e.g. "quote", "title") — minimal placeholder, under any `maxChars` |
| number | `1` |
| array | `["<Key> 1", "<Key> 2", "<Key> 3"]` (clamped to `defaultMaxItems ?? support.maxItems ?? 3`) |
| image | `{ url: "", alt: "<Key>" }` (empty url → component renders nothing or a swatch) |

Required keys (`support.required === true`) always hydrated. Optional keys hydrated too (better preview). Per-manifest `maxChars` respected.

Helper `hydrateDefaultContent(supportedContentKeys)` → `{ content }`. Pure function, unit-testable. Put in `engine/contentKeys/defaults.js` (new file) so it's reusable outside server.

## Server design

**Stack**: single-file Node HTTP server (`server/index.js`), zero deps beyond what `package.json` has. Babel/JSX transform handled two ways (pick one):

- **Option A (preferred)**: SSR-style. Server imports each structure `.jsx` via a tiny JSX→JS pre-pass using `esbuild` (already a transitive dep of `@remotion/bundler`? check) OR `@babel/standalone` bundled at runtime. Risk: Remotion `useCurrentFrame` returns 0 statically, so animations render frame-0 (fine for static previews but stale).
- **Option B**: let Remotion's bundler render each variation to a poster frame (PNG) and serve images. Heavy (one bundle + render per variation), but accurate.
- **Option C (lightest, ship first)**: serve a static HTML gallery listing all templates + link to variation; variation page mounts the React component in-browser via an inline ESM build. Use Vite (sub-dep) one-config. `vite` not in `package.json` yet.

Decide Option C: add `vite` + `@vitejs/plugin-react` to `devDependencies`. Vite handles JSX + HMR + importing `.jsx` structure files directly. Server = Vite dev server with one route per variation. No SSR.

**Routes** (single Vite app `server/`):
- `/` → gallery grid: one card per `templateId × variationId`. Card = server-side rendered HTML shell + client import of structure component.
- `/preview/<templateId>/<variationId>` → full 1080×1920 canvas, mounts `<StructureComponent content={defaultContent} style={variation.style} animation={variation.animation} />` inside a fixed-aspect div (scale-to-fit).

**Client entry** (`server/main.jsx`):
1. Fetch `/api/templates` → `{ templates: [{ templateId, family, variations: [{ id, structure, style, animation, defaultContent }] }] }`.
2. Renders either gallery or single preview based on `window.location.pathname`.

**API endpoint** (`/api/templates`):
- On server boot: `discoverTemplates("templates")` once → registry.
- For each template × variation: build `structureKey` (`family-templateId-structure`), attach `defaultContent` via `hydrateDefaultContent(supportedContentKeys)`, attach structure component path (`/templates/<family>/<id>/<structure>` — Vite serves files as ESM).
- Return JSON.

## Files to create

1. `engine/contentKeys/defaults.js` — `hydrateDefaultContent(supported)` + `defaultFor(key, def, support)`. Export `hydrateDefaultContent`. Add `import` test stub.
2. `server/index.html` — Vite root, mounts `server/main.jsx`.
3. `server/main.jsx` — client router (gallery ↔ preview), imports structure components dynamically via URL.
4. `server/server.js` — Node API plugin (Vite `configureServer`) returning `/api/templates` JSON.
5. `server/vite.config.js` — alias `@engine` → `../engine`, `@templates` → `../templates`, react plugin, port 5174.
6. `package.json` — add `devDependencies: vite, @vitejs/plugin-react`; add `"preview": "vite --config server/vite.config.js"` script.

## Files NOT touched

- Existing pipeline1/2/3, discovery, registry (only consumed, not modified).
- All `templates/**/*.jsx` (mounted as-is).
- `engine/pipeline3/*` (render path stays separate).

## Pitfalls / guards

- Structure files import from `remotion` (`AbsoluteFill`, `useCurrentFrame`, `interpolate`). Vite must resolve `remotion` from repo `node_modules` — works OOTB since it's a dep.
- `useCurrentFrame()` outside a Remotion `<Composition>` throws/returns NaN? Verify: Remotion's `useCurrentFrame` reads from `TimelineContext`; outside a composition it returns 0 but may warn. Wrap preview in a minimal `TimelineContext.Provider` that always returns 0 + a frame scrubber slider (nice UX, optional scope). If it throws, add the provider.
- `defaultContent` arrays must respect `maxItems` from manifest `support` (preferred) or registry `defaultMaxItems`.
- Image-type defaults: empty-string url → components like `gallery/single-image-zoom` may render broken img. Acceptable for preview v1; later add placeholder data URL.
- `validateAndTruncateContent` is idempotent on already-truncated default content — call it once at boot for parity.

## Verification

1. `node -e "import('./engine/contentKeys/defaults.js').then(m => console.log(m.hydrateDefaultContent({quote:{required:true,maxChars:220},items:{maxItems:3}})))"` — prints sane defaults.
2. `npm run preview` boots Vite, opens `/`, shows 34-template grid.
3. Click a card → `/preview/brand/anthropic-quote/cream` → renders the quote card at 1080×1920 scaled to viewport.
4. No console errors; no Remotion chromium bundle step invoked.

## Open decisions (pick before coding)

- Frame scrubber in preview (slider 0..N) vs static frame-0 only? v1: static frame-0.
- Gallery shows 1 thumbnail per variation, or 1 per template (first variation)? v1: per variation (44 cards).
- Add `vite` to root `package.json` or to a separate `server/package.json`? Pick root — simplest `npm i` story.
