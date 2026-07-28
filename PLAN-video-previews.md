# Plan: video previews + paginated loading + routing fixes

Three asks, all in `server/main.jsx` + a new server-side render service:

1. **Each preview is a video** — gallery cards show `<video>` tags playing pre-rendered MP4s of each variation, not live Remotion `<Player>` mounts.
2. **Paginated loading** — gallery renders cards in pages (e.g. 12 at a time), appends on scroll-to-bottom, instead of mounting all 44 at once.
3. **Navigation works without refresh** — clicking a card routes to /preview/<id>/<variation>; back returns to gallery; no full-page refresh required.

## Bug hunt — why routing is broken today

Verified by clicking `brand/anthropic-quote` card in the running app:
- The card is an `<a href="#/preview/brand/anthropic-quote/cream">`.
- Click does NOT change `location.hash` — because the `<a>` is hijacked by the inline `<Player>`, whose own click-to-play/swallow-click handler intercepts the click on its surface. Setting `location.hash` manually then dispatching `hashchange` did re-render the Gallery but the route regex `/^\/preview\/([^/]+)\/([^/]+)$/` fails to match `/preview/brand/anthropic-quote/cream` because `templateId` contains a `/`. So even with hashchange firing the App sees no match and stays on Gallery.
- Result: user clicks →_hash unchanged (Player ate the click) or hash updates via manual nav → App can't match → page appears stuck. Browser refresh reads the hash but regex still fails → still stuck. The "must refresh" symptom is partly this stale state plus the URL never actually carrying `#/preview/...`.

Two distinct bugs:
- **A.** `<a>` is wrapped around `<Player>`, so anchor navigation is killed by the Player's internal click handling on the film surface.
- **B.** Route regex disallows `/` inside templateId, so even a correct hash never matches.

## Fix B (routing) — single-segment encoding

`templateId` is `family/<id>`, e.g. `brand/anthropic-quote`. Use `encodeURIComponent(templateId)` (which escapes the `/` as `%2F`) on link gen and `decodeURIComponent` on parse. Verify the existing code already does this:
- `main.jsx:157`: `href={#/preview/${encodeURIComponent(v.templateId)}/${encodeURIComponent(v.variationId)}}` — link is `#/preview/brand%2Fanthropic-quote/cream`.
- `main.jsx:51-52`: `decodeURIComponent` already applied.
- But `main.jsx:49` regex `/^\/preview\/([^/]+)\/([^/]+)$/` — the `[^/]+` consumes only `brand` (stops at the literal `/` after `brand`), so the encoded `%2F` is fine AFTER decode, but the regex runs on the RAW route. Check order:

Looking carefully: `useRoute` returns `window.location.hash.slice(1)` UN-decoded. So hash `#/preview/brand%2Fanthropic-quote/cream` → route `/preview/brand%2Fanthropic-quote/cream`. The regex `[^/]+` matches `brand%2Fanthropic-quote` because `%2F` is not a literal `/`. So `decodeURIComponent` on the captured `m[1]` produces `brand/anthropic-quote`. OK in theory.

Where's the real failure then? The browser SNAPSHOT I captured shows card links are bare `<a>` without visible href encoded with `%2F` (link text shows `brand/anthropic-quote` but href should be encoded). The bug I observed: clicking did NOTHING (hash stayed empty). That means click → Player surface → event swallowed. So the regex might actually work once we get the click through. Confirmed: setting `location.hash` manually to `#/preview/brand/anthropic-quote/cream` (with raw `/`) → regex fails; but setting `#/preview/brand%2Fanthropic-quote/cream` should match.

Actions for fix B:
- Make the card NOT swallow the click — see fix A below.
- Verify regex matches `/preview/brand%2Fanthropic-quote/cream`. It should (`%2F` not literal `/`).
- Add explicit `onClick` on the card that calls `e.preventDefault(); window.location.hash = href;` so it bypasses any inner Player handlers.
- Simpler + bulletproof: drop the `<a>` wrapper and use a `<div onClick>` that does `window.location.hash = ...` directly. No anchor, no Player click stealing, deterministic navigation.

## Fix A (click swallowed by Player)

Root cause: `<a>` wraps `<Player>`; Player's film surface has its own click-to-play handler and `event.stopPropagation()`-style behavior. Anchor never receives the click.

Cleanest fix: in `GalleryCard` don't mount `<Player>` — for the video-preview design (#1 below) the card body becomes a `<video>` element, which has no click-stealing JS. Click anywhere on the card → anchor navigation works. For the dedicated PreviewView page (already working since it's reached by direct URL/refresh), keep `<Player>` for the interactive scrub/controls view.

## #1 — Make each preview a video

Replace inline `<Player>` per card with `<video>` sourced from a pre-rendered MP4 of each variation. Two implementation routes:

### Route 1 (recommended): server-side render via `@remotion/renderer`

Repo's `engine/pipeline3/render.js` already uses `bundle` + `renderMedia` from `@remotion/renderer`. Chromium headless shell already downloaded at `node_modules/.remotion/chrome-headless-shell/...` (verified by `npx remotion browser ensure`).

But the existing `RemotionRoot.jsx` only registers a multi-scene `StoryboardVideo` composition driven by `getInputProps().renderInput` — not a single-variation composition. Need a separate Remotion entry that registers a generic `SingleVariation` composition taking `{ variation }` inputProps and mounting that structure component directly.

New file `server/renderEntry.jsx`:
```jsx
import React from "react";
import { Composition, getInputProps, registerRoot, AbsoluteFill } from "remotion";
import { STRUCTURE_COMPONENTS } from "../engine/pipeline3/Structures.jsx";

const Variation = ({ variation }) => {
  const Comp = STRUCTURE_COMPONENTS[variation.structureKey];
  if (!Comp) return <AbsoluteFill style={{background:"#000"}} />;
  return <Comp content={variation.defaultContent} style={variation.style} animation={variation.animation} />;
};

const Root = () => {
  const { variation } = getInputProps();
  return (
    <Composition
      id="SingleVariation"
      component={Variation}
      fps={30}
      width={270}       // low-res preview: 1080/4
      height={480}      // low-res preview: 1920/4
      durationInFrames={60}
      defaultProps={{ variation }}
    />
  );
};
registerRoot(Root);
```

Problem: `STRUCTURE_COMPONENTS` is auto-generated by `engine/pipeline3/copyStructures.js` and glues all templates via static imports — that module is regenerated by `preparePipeline3` against a `templateRegistry`. We can call `generateStructuresModule(registry, outputPath)` to (re)build it once at server boot, then import the entry that imports `Structures.jsx`.

Render invocation (`server/render.mjs`, new):
- Once at server boot (or lazily per-request with on-disk cache): iterate registry, bundle the renderEntry once (shared bundle!), then `selectComposition({ id: "SingleVariation", inputProps: { variation } })` + `renderMedia({ codec: "h264", outputLocation: mp4Path, inputProps })` per variation.
- Cache MP4s to `server/.cache/videos/<structureKey>.mp4`. Skip if exists + non-empty. Adds `.cache/` to `.gitignore`.
- Serve via a Vite middleware `GET /video/:structureKey.mp4` streaming the cached file with proper `Content-Type: video/mp4` + `Accept-Ranges`.
- Render specs: 270×480 @ 30fps, 60 frames (2s) — small enough that 44 × 2s @ low-res renders in a few minutes total. Render on first-request or in a boot-time background queue; client shows a placeholder poster until the file is ready.

Boot-up OR lazy: prefer lazy with a fallback — first request to `/video/<key>.mp4` triggers render (await), subsequent reads stream the cached file. Simpler UX than a boot queue that blocks startup, and avoids rendering variations the user never looks at. But the user wants every preview visible, so a boot-time background queue that processes all 44 in series and notifies via polling is the better UX:
  - Server boots, kicks a single background worker that renders every variation MP4 sequentially (avg ~5s each → ~4 min total).
  - Client asks for `/api/videos/status` → `{ ready: [...], pending: [...] }`. Renders cards whose MP4s are ready; shows "rendering…" poster for pending; polls every 3s and swaps in `<video>` when ready.

### Route 2 (lighter): use the existing Player and capture its canvas via MediaRecorder in-browser

Skip — Player has no canvas/streaming API exposed, and writing a MediaRecorder wrapper around React rendering is fragile. Rejected.

### Route 3 (reject): server-side still PNG only

`renderStill` is ~1s per variation but the user explicitly said "video." Rejected for the main UX, but still PNGs are a good FALLBACK poster shown before the MP4 is ready or if render fails. Use `renderStill` to populate `server/.cache/posters/<key>.png` first (fast), queue MP4s after.

## #2 — Paginated loading

Gallery currently renders all 44 cards in DOM at once; with inline Players that's 44 Remotion compositions → heavy. With videos, that's 44 `<video>` elements → also heavy (browser keeps decoded frames per video).

Add page-based incremental rendering:
- State `visibleCount` starts at 12.
- Render only `templates.slice(0, visibleCount)` (preserving family grouping — group AFTER slice).
- Sentinel `<div ref={sentinelRef}>` at page bottom; IntersectionObserver fires when sentinel enters viewport → `setVisibleCount(n => n + 12)`.
- Stop when `visibleCount >= templates.length`.
- Each `<video>` uses `preload="none"` until the card itself is in view (existing IntersectionObserver per card) — combined with page-level pagination, never more than ~12 videos decoding at once.

Data model: gallery flat list = `data.templates` (44 items). Flatten by index, paginate by index, then group visible slice by family for section headers. Keeps the existing "grouped by family" UI with paginated growth.

## #3 — Routing fix (combined with A+B)

Replace `<a>` wrappers in `GalleryCard` with `<div onClick={go}>`. `go` does `window.location.hash = "#/preview/${encodeURIComponent(templateId)}/${encodeURIComponent(variationId)}"`. No captured inner element, deterministic navigation.

`useRoute` already listens to `hashchange` and re-renders. Confirmed Route regex matches the encoded form. Keep the `#/preview/<encoded templateId>/<variationId>` shape.

Optional polish: support browser back button via hashchange (already works). Update document.title when in preview.

## Files to create / modify

1. **`server/renderEntry.jsx`** (new) — Remotion entry registering `SingleVariation` composition, importing the auto-generated `Structures.jsx`.
2. **`server/render.mjs`** (new) — exports `ensureStructureModule(registry)`, `renderVariationVideo(variation, outPath)`, `renderVariationPoster(variation, outPath)`. Uses `@remotion/bundler` `bundle`, `@remotion/renderer` `selectComposition`/`renderMedia`/`renderStill`.
3. **`server/vite.config.js`** (modify) — boot-time: call `discoverTemplates`, `generateStructuresModule` to refresh `engine/pipeline3/Structures.jsx`, then start the render worker (lazy + queue). Add Vite middleware `GET /video/:key.mp4`, `GET /poster/:key.png`, `GET /api/videos/status`. Cache dir `server/.cache/`.
4. **`server/main.jsx`** (modify) — Gallery:
   - Paginated: `visibleCount` + sentinel observer.
   - `GalleryCard` uses `<video>` with `src=/video/<key>.mp4` + `preload=none` + per-card IO to mount `<video>` element when in view; `poster=/poster/<key>.png` fallback; "rendering…" overlay while pending.
   - Card click → `go()` sets hash; drop the wrapping `<a>` (fix A).
   - `useRoute` regex unchanged (already handles encoded slashes).
   - `PreviewView`: keep `<Player>` for the full interactive preview (scrubbing, controls) — the user explicitly wants gallery thumbnails to be videos, not the full preview page.
5. **`.gitignore`** (modify, repo root) — add `server/.cache/`.

## Pitfalls / guards

- `Structures.jsx` auto-gen path is `engine/pipeline3/Structures.jsx` — regenerate it at boot to ensure static imports cover every discovered template. If `copyStructures.js`'s `generateStructuresModule` API changed, check signature: it takes `(templateRegistry, outputPath)`. Already verified.
- `@remotion/bundler` `bundle({ entryPoint })` is heavy (~5s). Call ONCE per server boot — share across all variations. Reuse `serveUrl` for every `selectComposition`/`renderMedia`.
- `renderMedia` requires `inputProps` matching the composition's `defaultProps` shape — pass `{ variation }` (with `structureKey`, `defaultContent`, `style`, `animation`) directly.
- Video element autoplay: `autoPlay muted loop playsinline` — mobile Safari requires `playsinline`. Set all four.
- Pagination + per-card IO: only mount `<video>` when page is visible AND card is in view; otherwise use placeholder. Otherwise scrolling past loads keeps all 12 page videos decoding forever.
- Render queue single-threaded: serializing renders avoids 44 chromium processes. Skip already-cached.
- Hashchange on initial load: if user lands at `#/preview/...` deep link, `useRoute` initial state reads hash → App shows PreviewView immediately. Already works.
- `.gitignore` for `server/.cache/` — don't commit GBs of MP4s.
- If `@remotion/renderer` ever errors (missing chromium in some envs), fall back to Player inline (old behavior) — print a console warning. Keep a `USE_VIDEO_PREVIEWS` env var / config flag to disable.

## Verification plan

1. Boot the dev server; open `http://localhost:5174/`.
2. After debounce: `GET /api/videos/status` returns 44 ready entries (may take ~4min on first boot — verify polling shows pending → ready transitions).
3. Gallery shows 12 cards initially; scroll → next 12; etc.
4. Each card shows the rendered template MP4 autoplaying, no console errors, no broken-img warnings.
5. Click any card → URL → `#/preview/<encoded>/<variation>`; PreviewView mounts without refresh; back button → gallery restored; no refresh required anywhere.
6. Direct deep-link `http://localhost:5174/#/preview/brand%2Fanthropic-quote/cream` loads PreviewView on a hard refresh.
7. No console errors throughout; only the Remotion license notice is acceptable.
8. Ad-hoc Node check: confirm `render.mjs` exports and that `renderVariationVideo` produces a non-empty MP4 for one variation before wiring the queue.

## Open decisions (pick before coding)

- Render resolution: 270×480 (4× downscale) at 60 frames. OK? Alternative: 540×960 at 90 frames (~3s), 4× larger files but crisper. v1: 270×480 @ 60f.
- Render trigger: boot-time background queue (block UX until ready ~4min) vs lazy per-request render (instant first paint, slow first card). v1: boot-time queue with status polling — user gets full UX once ready, posters (PNG) shown meanwhile via `renderStill` first pass.
- Keep `<Player>` on the dedicated preview page (interactive) or also swap to `<video>`? v1: keep Player — interactive scrubbing is valuable; the cards are the "video" UX.
- Pagination size 12 vs 8 vs 16. v1: 12.
