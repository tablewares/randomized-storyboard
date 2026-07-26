# Research → Storyboard Variations (Same Story, Drastically Different Treatments)

A reusable workflow when the user asks for **one researched story rendered as
multiple drastically different storyboards**. Tested on the MOXIE Mars oxygen
story (2025-07-25); three variations — snappy listicle, cinematic 7-scene arc,
image-led visual gallery — all compiled to 1080×1920 MP4 via `node main.js`.

## The recipe

1. **Pick one story with visual + numerical + quoted texture.** You need a story
   that has at least: a striking number (e.g. 122g of oxygen), a verbatim quote
   (NASA/JPL source), a timeline (launch → land → first run → final run → next
   steps), and at least one comparison axis (1 ton breathing vs 25 tons lifting
   off). Without all four, you can't build *drastically* different storyboards
   from the same facts.

2. **Web-research the ground facts before writing any scene.** Use `web_search`
   to find the authoritative source, `web_extract` to pull clean text, then
   `read_file` on the saved cache file (`/home/tablewares/.hermes/cache/web/...`)
   with `offset` to page into the body. Don't paraphrase from the search snippet
   — get the real numbers + full quote from the article body.

3. **List the live templates first** so every `templateId` you pin actually exists:
   ```bash
   node ~/.hermes/skills/project/randomized-storyboard-make-storyboard/references/list-templates.mjs
   ```
   This prevents the "guessed templateId" failure mode. The output lists every
   template's `req:`/`opt:` content keys — pick `content` from that, never invent.

4. **For image-led variations, pull real images via the in-repo yandex adapter**
   (see next section). Wikimedia Commons URLs are the most reliable — they pass
   through pipeline 2's media resolver as remote URLs and render via `<Media>`
   without staging.

5. **Build 3 variations that differ along orthogonal axes:**
   - **Scene count**: 3 (punchy) vs 7 (narrative arc) vs 5 (visual flow).
   - **Template families exercised**: mix at least 4 families across the set
     (hero, lists, stat, timeline, gallery, comparison, quote — the catalog has 8).
   - **Tone/palette**: each variation gets its own `globalStyle` palette so the
     difference is felt immediately, not just structural.
   - **Voice register**: snappy declarative vs quote-driven cinematic vs
     image-caption explanatory. Same voiceId, different lengths/sentences.
   - **Music**: only the longer "cinematic" variation sets `music.path`. Listicle
     and visual-gallery stay music-free for contrast.

6. **Validate each with `score-storyboard.mjs`** in a single loop before any render:
   ```bash
   for sb in storyboard.*.json; do
     node ~/.hermes/skills/project/randomized-storyboard-make-storyboard/references/score-storyboard.mjs "$(pwd)/$sb"
   done
   ```
   All must exit 0. Below-threshold warnings on pinned scenes (templateId bypasses
   scoring) are informational — accept them, don't chase keywords to "fix" them.

7. **Compile each in turn via main.js with `--output` split per variation:**
   ```bash
   node main.js --config storyboard.config.json --storyboard storyboard.X.json --output dist/X
   ```
   Each produces `dist/X/<storyboard.id>.mp4` (1080×1920 H.264 + 192k audio).
   Verify with `ffprobe -show_entries stream=codec_type,duration,width,height`.

8. **Post-render sanity check**: load each `dist/X/render-input.json` and confirm
   every scene has a non-empty `structurePath` *and* `content` keys that match the
   pinned template's supported keys. If any scene's `structurePath` is empty or
   keys are missing, you hit the missed-`await` or stale-`Structures.jsx` bug —
   see SKILL.md pitfalls, do NOT hand off as "rendered successfully".

## Pulling images via the in-repo opencli-yandex-images adapter

The repo ships a self-contained OpenCLI adapter at `skill/opencli-yandex-images/`.
It is NOT installed by default — install it into the user opencli tree first:

```bash
mkdir -p ~/.opencli/clis/yandeximages
cp skill/opencli-yandex-images/bin/search.js ~/.opencli/clis/yandeximages/search.js
opencli list | grep -A1 yandeximages   # confirms discovery
```

Then search and emit JSON (pipe through `jq -r '.[].image_url'` for just URLs):

```bash
opencli yandeximages search "Perseverance rover Mars surface" --limit 6 -f json
```

Notes from real use (2025-07-25):
- The adapter's README says "could not test against yandex.com from my sandbox"
  — **disregard that caveat**. With a real network, it returns results in ~20s
  per query. Wikimedia Commons, YouTube thumbnails, and pikabu images dominate
  space/astronomy queries.
- `image_url` is the direct image; `thumb_url` is often empty. `width`/`height`
  are usually 0 (Yandex's DOM extractor doesn't pull them).
- Stable-yielding sources for science/space stories (in reliability order):
  1. `upload.wikimedia.org/wikipedia/commons/...` — best for factual illustrations.
  2. `images-assets.nasa.gov` and `www.nasa.gov/wp-content/uploads/...` — NASA.
  3. `i.pinimg.com/originals/...` — photographic variety.
  4. `i.ytimg.com/vi/<id>/maxresdefault.jpg` — YouTube thumbnails; render fine.
  5. `cs*.pikabu.ru/...` — Russian aggregator; images load but URLs can expire.

## Variations checklist (the class-of-work definition)

A "drastically different variations" task is **done** when, for each variation:

- [ ] Storyboard passes `score-storyboard.mjs` (exit 0).
- [ ] Every scene's `templateId` (or resolved-by-scoring template) is in the live
  catalog and pins a `structurePath` that exists in `render-input.json`.
- [ ] Every scene's `content` keys are a subset of that template's supported keys
  (check `pipeline2-output.json` `contentWarnings` — zeroes means clean).
- [ ] For image scenes: every `url` in `image`/`images` resolved without
  `mediaWarnings` in `pipeline2-output.json` (remotes pass through, no staging).
- [ ] `dist/<variation>/<id>.mp4` exists, is 1080×1920, has video+audio streams
  (`ffprobe`), and runs ≥ 1 `ffprobe`-reported second.
- [ ] The three variations visibly differ along ≥ 2 of: scene count, template
  family mix, palette, voice-register, music presence.

## Example variations (MOXIE story, 2025-07-25)

Same facts (16 runs, 122g, 98% purity, Jim Reuter quote, 1t vs 25t, 800°C, 2021
first run, 2023 final run, 2030s human mission) rendered as:

| Variation | File | Scenes | Families used | Palette |
|---|---|---|---|---|
| Snappy listicle | `storyboard.moxie.listicle.json` | 3 | hero, lists | dark navy + warm orange accent |
| Cinematic arc | `storyboard.moxie.cinematic.json` | 7 | hero, stat, timeline, lists | black + serif/cream editorial gold |
| Visual gallery | `storyboard.moxie.visual.json` | 5 | gallery, comparison | graphite + cyan accent |

All three compiled cleanly via `node main.js --config storyboard.config.json
--storyboard <file> --output dist/moxie-*`. Output sizes ranged 0.7-8.2 MB;
durations 12-37s.
