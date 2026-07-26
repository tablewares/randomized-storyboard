# Voiceover Timing — engine/pipeline1 (current layout)

Concrete reference for how scene timings are produced, the dataflow that
consumes them downstream, and the bug families that produce "TTS cut short"
and "scenes not on time" symptoms. This is the authoritative detail for the
SKILL.md's "Pipeline 1: Voiceover Timing" subsection.

## Entry-point layout (current `engine/pipeline1/`)

NOTE: this supersedes the older `src/pipeline1/{timing.js,scoring.js}` layout
that older versions of this skill describe. The working tree on `main` as
of 2025-07-25 uses the `engine/` layout driven by `main.js` →
`orchestrator.js` → `engine/pipeline1/index.js`. If the two layouts ever
disagree, **the `engine/` layout is what actually runs.**

Files:
- `engine/pipeline1/voiceover.js` — `synthesizeAndAlign(segments, options)`
  is the single entry point that returns `{ audioPath, sceneTimings[] }`.
- `engine/pipeline1/whisperAlign.mjs` — `alignAudioWords()` (shells out to
  `fasterWhisperTranscribe.py`) + `alignStoryboardToTranscript()` (LCS-based
  per-scene boundary recovery).
- `engine/pipeline1/kyutai_tts.js` — `synthesizeVoice()` POSTs to
  `localhost:8000/tts`; `getAudioDurationSec()` shells out to `ffprobe`.
- `engine/pipeline1/fasterWhisperTranscribe.py` — faster-whisper
  word-timestamp transcription (CTranslate2, replaces WhisperX).
- `engine/pipeline1/index.js` — `runPipeline1(storyboard, config)` calls
  `synthesizeAndAlign` then does template scoring + transition selection.

## Timing dataflow (the timing-truth chain)

This is the chain that makes "last scene ends early" == "TTS cut short":

```
storyboard.scenes (.voiceover text, .id)
  → runPipeline1 (engine/pipeline1/index.js) builds segments {id, text}
  → synthesizeAndAlign (voiceover.js)
      PATH 1 (options.workDir set — the path that runs in production):
        1. join scene texts → "combined_voice.mp3" via synthesizeVoice
        2. transcribe mp3 with faster-whisper → word-level [{word,start,end}]
        3. alignStoryboardToTranscript → per-scene {start,end} boundaries
        4. derive sceneTimings[] {sceneId, startSec, endSec, start, end}
        5. CLAMP last scene's endSec up to real audio duration (ffprobe)
      PATH 2 (no workDir — dry-run fallback):
        WPM estimate only, no TTS, no transcription
  → pipeline1.sceneTimings is the TIMING TRUTH for the rest of the engine
  → pipeline2/index.js attaches timing onto each HydratedScene.timing
  → pipeline3/index.js:31  totalDurationSec = Math.max(...endSec)
  → engine/pipeline3/StoryboardVideo.jsx:
      sceneFrames[i].durationInFrames = round((endSec - startSec) * fps)
      <TransitionSeries.Sequence durationInFrames={...}> per scene
      <Audio src={staticFile(audioPath)}> plays the FULL mp3 unconditionally
```

Key invariant: the `<Audio>` element plays the full audio track regardless of
scene boundaries, but each scene's VISUAL sequence is bounded by its
`endSec`. So **if `last scene.endSec < real mp3 duration`, the rendered mp4
ends at `endSec` and the TTS tail (trailing breath, final consonant decay,
silence added by the TTS engine) is cut off.** This is the entire mechanism
behind "TTS cut short."

A second, subtler timing-truth violation lives downstream in pipeline 3
itself, NOT pipeline 1 — Remotion's `<TransitionSeries>` shifts the
entering scene *backward in time* during `<TransitionSeries.Transition>`
(overlapping scenes during the crossfade), which silently desyncs the
visual timeline from the contiguous pipeline-1 partition. Documented as
its own bug family in "TransitionSeries overlap desync (pipeline 3 →
render)" below. Symptoms look like pipeline-1 issues ("scenes not on
time", "sfx not on scene-end") but the fix is in
`engine/pipeline3/StoryboardVideo.jsx`, not the voiceover path.

## Bug → fix map (session 2025-07-25)

These were all found and fixed in one pass; the fixes live in
`whisperAlign.mjs` and `voiceover.js`:

| Symptom | Root cause | Fix site |
|---|---|---|
| TTS audio tail cut off in final mp4 | Last scene's `endSec` came from the last matched word's `end`, which is ~200–500 ms before the real mp3 ends; Remotion stops rendering at `endSec*fps` | `voiceover.js:175-181` clamps `last.endSec` up to `getAudioDurationSec(audioPath) + TAIL_PAD_SEC(0.05)` |
| Scenes start late / eat padding | Each scene's `start` was derived as previous scene's `end`, ignoring the actual first-word timestamp | `alignStoryboardToTranscript` now returns `{start,end}`. `start` = first matched word's `start`; `voiceover.js` consumes the new shape |
| First scene starts mid-audio | If first spoken word landed at e.g. 0.4 s, scene 1's first frame started there | `voiceover.js:151` forces `scene[0].start = 0` (audio begins at t=0) |
| `speed` / `WORDS_PER_SECOND` config silently ignored | `{WORDS_PER_SECOND = 2.5}` was destructured inside Path 1's scope and never read (Path 1 measures real audio, doesn't estimate from WPM) | Promoted to module const `DEFAULT_WORDS_PER_SECOND`; Path 2 now honors `options.WORDS_PER_SECOND` / `options.speed` explicitly; Path-1 dead destructure removed |
| Whisper mis-orders a word → scene end < start | No monotonicity guard | Both `whisperAlign.mjs` and `voiceover.js` re-clamp: `start >= prevEnd`, `end >= start`, `end >= 0` |
| Empty-text scene recovered a bogus `0.0s` timestamp | `count === 0` branch returned `lastEnd` unconditionally | Now returns `{start: null, end: null}` explicitly; caller collapses to previous end |
| Visual drift accumulates scene-over-scene (next scene's animation fires early vs its voiceover) | Every non-last scene's `endSec` came from the raw aligned/estimated boundary; downstream `Math.round(endSec*fps)` systematically loses up to ~0.5/fps sec per scene and compounds because `start = prevEnd` | `voiceover.js` pads every non-last scene's `endSec` by `SCENE_END_BUFFER_SEC` (0.08s default, both paths). The buffer becomes the next scene's `start` (via `prevEnd = end`) — absorbed into the contiguous timeline, not a silent audio gap (the `<Audio>` element plays the full mp3 regardless) |
| Path 2 WPM estimate runs ahead of real TTS (later scenes desync) | WPM estimate has no real audio anchor; per-scene error compounds scene-over-scene so by scene N the recovered `startSec` is N×error ahead of where the real TTS actually is | `voiceover.js` Path 2 adds `ACCUMULATION_PAD_PER_SCENE_SEC` (0.12s default) per scene on top of the end buffer, biasing each estimated duration long so cumulative headroom builds — later scenes' `startSec` lags real TTS rather than running ahead (a lag is recoverable; running ahead desyncs visuals from voiceover) |

## `alignStoryboardToTranscript` return contract

Returns `Array<{start: number|null, end: number|null}>` in scene order.
- non-null `start` = first matched word's `start` (forward-then-backward fallback)
- non-null `end` = last matched word's `end` (backward-then-forward fallback)
- `null` means no anchor found (empty-text scene or total match failure) —
  caller is expected to collapse it to the previous scene's end.

Backward-compat: callers that only need end times (the old return shape was
a flat numeric array of end-times) can read `.end` from each element. The
single in-repo consumer (`voiceover.js`) was updated in the same change.

## Smoke-testing the timing pipeline without a TTS server

Pure-logic tests for `alignStoryboardToTranscript` and Path 2 of
`synthesizeAndAlign` need no stubbing — import and call directly.

Testing **Path 1 end-to-end** requires stubbing `synthesizeVoice`,
`getAudioDurationSec`, `alignAudioWords`, and `alignStoryboardToTranscript`
since native ESM doesn't allow reassigning imported bindings. Use Node's
module customization hooks:

```js
// .smoke_path1.mjs
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register(pathToFileURL("./.smoke_path1_hooks.mjs").href, pathToFileURL(import.meta.url));
const { synthesizeAndAlign } = await import("./voiceover.js");
// ... assertions ...
```

```js
// .smoke_path1_hooks.mjs
export async function load(url, context, nextLoad) {
  if (url.endsWith("/kyutai_tts.js"))
    return { format: "module", source: STUB_SYNTH, shortCircuit: true };
  if (url.endsWith("/whisperAlign.mjs"))
    return { format: "module", source: STUB_WHISPER, shortCircuit: true };
  return nextLoad(url, context);
}
```

Pitfall: `register()`'s second arg must be a `pathToFileURL(...).href`, not
a bare relative path string — the latter gets mangled as
`file:/.../file:/.../...` and throws `ERR_MODULE_NOT_FOUND`.

A working 25-assertion smoke harness (15 on `alignStoryboardToTranscript`
{start,end} shape, 10 on Path 1 TTS-cut-short fix with stubbed 10.30s audio
clamping last scene from 9.80 up to 10.35) was written, run green, and
deleted in the session that produced this reference — regenerate with the
shape above when needed; don't commit smoke artifacts to the repo.

## Accumulation buffer design (session 2025-07-25)

The two new pads (`SCENE_END_BUFFER_SEC`, `ACCUMULATION_PAD_PER_SCENE_SEC`)
were added because the **TTS tail clamp only fixes the LAST scene** — but
downstream `Math.round(endSec * fps)` in `StoryboardVideo.jsx` introduces a
*systematic* rounding error that compounds across every scene whose start is
computed as the previous scene's rounded end. Over a 10-scene storyboard at
30 fps the cumulative drift can exceed 100 ms, enough that scene N's visual
fires noticeably earlier than its actual voiceover word lands.

Design constraints the implementation satisfies:

- **Buffer becomes the next scene's start, not a silent audio gap.** Because
  `prevEnd = end` is the engine's contiguous-partition invariant
  (`voiceover.js` Path 1 loop), padding `end` automatically shifts the next
  scene's `start` later by the same amount. The `<Audio>` element plays the
  full mp3 regardless, so the buffer is observed as a slight pause before the
  next visual fires — not as a hole in the audio.
- **Last scene is excluded from the per-scene end buffer.** The last scene's
  end is governed by the ffprobe tail clamp (`audioDurationSec + TAIL_PAD_SEC`),
  which is the authoritative extension for that scene. Applying both would
  double-pad. Implementation:
  `if (i < segments.length - 1) { end = end + sceneEndBufferSec; }`.
- **Path 2 gets the extra accumulation pad on top.** Path 2 (WPM fallback, no
  `workDir`) has no real audio to anchor it, so per-scene WPM error compounds.
  The accumulation pad biases each estimated duration slightly long; by scene
  N the recovered `startSec` lags real TTS by N×pad (running behind is
  recoverable; running ahead desyncs visuals from voiceover).
- **Both pads are tunable through `voicecfg`**, see the section below. Set to
  `0` to disable entirely (e.g. for frame-perfect dry runs).

Verified end-to-end (example storyboard, 3 scenes): with default pads, scene-3's
`startSec` sits 0.4 s later than the raw WPM estimate (0.08 + 0.12 per
preceding scene × 2 scenes cumulative). Math matches
`words / (WORDS_PER_SECOND * speed) + sceneEndBufferSec +
accumulationPadPerSceneSec` to the millisecond per scene.

## tuning knobs

- `alignment.{model, language, device, compute_type}` — passed through to
  `fasterWhisperTranscribe.py`. Defaults: model `small`, language `en`,
  device `cpu`, compute_type `int8` (or `float16` when device != cpu).
- `speed` / `WORDS_PER_SECOND` (Path 2 only) — WPM-estimate fallback.
- `TAIL_PAD_SEC = 0.05` (Path 1, `voiceover.js`) — belt-and-suspenders pad
  added to the audio-duration clamp, guards against ffprobe/whisper clock
  skew. Bump it if the very final consonant is still clipped.
- `sceneEndBufferSec` (default `0.08`, BOTH paths, `voiceover.js`) — seconds
  added to every non-last scene's `endSec`. Absorbs frame-rounding drift and
  whisper breath-gap skew. Becomes the next scene's `start` via
  `prevEnd = end`, so it's a contiguous-timeline pause, not a silent audio
  gap. Set 0 to disable.
- `accumulationPadPerSceneSec` (default `0.12`, Path 2 only, `voiceover.js`) —
  extra per-scene headroom for the un-anchored WPM estimate. Builds cumulative
  lag so later scenes' recovered `startSec` doesn't run ahead of real TTS.
  Ignored in Path 1 (real audio anchors it). Set 0 to disable.
- The `voicecfg` object in `storyboard.config.json` is passed verbatim as
  `synthesizeAndAlign`'s `options` argument — anything you add there (e.g.
  `speed`, `WORDS_PER_SECOND`, `alignment`, `sceneEndBufferSec`,
  `accumulationPadPerSceneSec`) flows through. The two new knobs are
  destructured with defaults in `synthesizeAndAlign`'s signature, so adding
  them to `voicecfg` overrides the per-scene pad; omitting them keeps the
  module-level defaults.

## In-aligner drift accumulation — `alignStoryboardToTranscript` (2025-07-25)

`alignStoryboardToTranscript` (`engine/pipeline1/whisperAlign.mjs`) grew
an **opt-in** drift-accumulation path alongside the `voiceover.js`-side
pads above. Where the `voiceover.js` pads apply the accumulation buffer
*after* alignment returns raw boundaries, this path pushes the same
concept *inside* the aligner so the returned `{start,end}` already carries
the corrective offset.

Signature (only `sceneVoiceoverTexts` and `transcriptWords` are
required; everything else defaults to no-op):

```js
alignStoryboardToTranscript(
  sceneVoiceoverTexts,         // string[]
  transcriptWords,             // {word, start, end}[]
  {
    onLowConfidence,           // (info) => void  — pre-existing
    wordsPerSecond,            // enables accumulation. undefined = no-op.
    speed = 1,                 // speech-rate multiplier for WPM anchor
    minSceneDurationSec = 0.5, // per-scene WPM floor (matches voiceover.js Path 2)
    sceneEndBufferSec = 0,     // per-scene end pad inside the aligner. 0 disables.
    maxPerSceneDriftSec = 0.5, // clamp on per-scene delta added to accumulatedDrift
    accumulationPadPerSceneSec = 0, // biases each est. duration long. 0 disables.
  }
)
```

### How the accumulator works

Per scene i (in scene order):

1. Recover the raw whisper boundary `{start, end}` (first/last matched
   word timestamps) — same as before.
2. Apply `driftOffset = accumulatedDrift` (the sum of every *prior*
   scene's drift contribution) to this scene's `start` and `end`.
3. Apply `sceneEndBufferSec` to `end` if non-zero (the same idea as
   `voiceover.js`'s `SCENE_END_BUFFER_SEC` — just done here, inside the
   aligner).
4. Enforce monotonicity (`start >= lastEnd`, `end >= start`).
5. **Update the accumulator using this scene's own raw whisper end**
   (pre-offset — we want the comparison against the WPM model's
   prediction for this scene in isolation):
   ```
   estDuration   = max(count / (wordsPerSecond * speed), minSceneDurationSec)
                 + accumulationPadPerSceneSec
   estEnd        = prevRawEnd + estDuration
   perSceneDrift = rawEnd - estEnd
   clampedDelta  = clamp(perSceneDrift, -maxPerSceneDriftSec, +maxPerSceneDriftSec)
   accumulatedDrift += clampedDelta
   ```
   `prevRawEnd` is the previous non-empty scene's raw whisper `end` —
   same `resolveEndTime` lookup the boundary pass already does, so no
   new scan is needed.

The offset applied to scene i is the drift contributed by scenes
`[0, i-1]`. A scene cannot correct itself — only later scenes see its
contribution. This is by design: a measurement of *this* scene should
reflect what was actually spoken in *this* scene; the accumulation
corrects for the fact that real TTS pacing in earlier scenes shifted
where this scene sits on the timeline.

### Why clamp `maxPerSceneDriftSec`

Without a clamp, one outlier scene (whisper mishears a word and reports
its `end` 3 seconds after the previous word) would permanently shift
every subsequent boundary by 3 seconds. The default 0.5 s clamp is wide
enough to absorb real TTS pacing drift, narrow enough to contain
whisper glitches. The clamp is on the *per-scene delta* added to the
accumulator, not on the absolute accumulated drift — so genuine slow
TTS that runs 0.1 s/scene long across 20 scenes still accumulates to
the full 2 s (every per-scene delta is under the 0.5 s clamp), but a
single 3 s glitch only contributes 0.5 s.

### Layering: pick ONE path, not both

The `voiceover.js`-side pads and the in-aligner accumulation path are
**alternatives**:

- **Production today (`voiceover.js` Path 1):** keeps the post-hoc
  `end + sceneEndBufferSec` line in the Path 1 loop and does NOT pass
  `wordsPerSecond` into `alignStoryboardToTranscript`. The in-aligner
  path is dormant; behaviour is byte-identical to before the change.
- **Opt-in to the in-aligner path:** pass `wordsPerSecond` to
  `alignStoryboardToTranscript`. Then **remove** the
  `if (i < segments.length - 1) { end += sceneEndBufferSec; }` line in
  the Path 1 loop of `voiceover.js`, otherwise you double-pad every
  non-last scene. There is no auto-detection: the caller is responsible
  for picking one.

Left as alternatives deliberately — some downstream callers want raw
whisper boundaries and prefer to bolt the buffer on themselves (the
current `voiceover.js` shape); others want accumulation-aware
boundaries directly (any caller that doesn't have its own contiguous-
partition loop).

### WPM-anchor formula is intentionally identical to Path 2

`estDuration = max(count / (wordsPerSecond * speed), minSceneDurationSec) +
accumulationPadPerSceneSec` is the same expression `voiceover.js` Path 2
uses for its WPM estimate, byte-for-byte. This means the drift the
accumulator measures is *exactly* the gap between real TTS pacing and
the same WPM model Path 2 uses — so the per-scene drift is comparable
across the two paths, and a caller comparing them isn't comparing
apples and oranges.

### Ad-hoc verification recipe (no `npm test` in this repo)

The repo has no canonical test/lint/build — verify changes to
`alignStoryboardToTranscript` with a throwaway script under `/tmp/`
named `hermes-verify-align-*.mjs`, run it green, then delete it. Don't
commit one-off verifiers (matches the existing
references/voiceover-timing.md guidance for Path 1 smoke harnesses).

Fixture shape (what the 2025-07-25 change was verified with — 18
assertions):

- 5 scenes, 4 words each, WPM = 150/60 (0.4 s/word).
- Planted whisper ends: scene 0 nominal, s1 +0.12 s drift, s2 +0.24 s,
  s3 **+3.0 s** (the outlier-clamp test), s4 nominal.
- Expected accumulated offsets applied to each scene i =
  `sum(clamp(drift_s)) for s in [0, i-1]`:
  - s0 → 0 (no prior)
  - s1 → 0 (s0 drift was 0)
  - s2 → 0.12 (s1)
  - s3 → 0.12 + 0.24 = 0.36 (s1 + s2)
  - s4 → 0.12 + 0.24 + 0.5 = 0.86 (s1 + s2 + clamp(s3's +3.0 to +0.5))

Assertions that mattered (all pass on the green run):

1. **Backward-compat** — no opts → raw monotonic whisper boundaries,
   `scene[0].start === 0`, `every scene.end >= scene.start`,
   array shape unchanged.
2. **Per-scene drift** — with `wordsPerSecond` set, `scene[i].start ===
   whisperStart[i] + expectedOffset[i]` to 1e-6.
3. **Outlier clamped** — `scene[4].start === whisperStart('rho') +
   0.86` (NOT `+ 3.36`), proving `maxPerSceneDriftSec` contains the
   glitch.
4. **Determinism** — two identical calls return identical JSON.
5. **Speed sensitivity** — `speed: 2` shortens `estDuration`, grows
   per-scene drift, produces larger offsets on later scenes than
   `speed: 1`.
6. **Monotonicity post-accumulation** —
   `resB[i].start >= resB[i-1].end - 1e-9 && resB[i].end >= resB[i].start - 1e-9`.
7. **Existing-caller compat** —
   `{ onLowConfidence: fn }` only (no `wordsPerSecond`) still returns
   numeric `.end` on each element, exactly the pre-change shape that
   `voiceover.js:162` relies on.
8. **Textless scene** — scene with `count === 0` emits
   `{start: null, end: null}` and contributes no drift (no measured
   boundary to compare against).

Run with:

```bash
mktemp -p /tmp -t hermes-verify-align-XXXXXX.mjs
# (write the harness to that path, importing the real whisperAlign.mjs via file:// URL)
node /tmp/hermes-verify-align-*.mjs && rm /tmp/hermes-verify-align-*.mjs
```

The smoke harness was 18 assertions / 9 logical checks (backward-compat
shape, per-scene drift math, outlier containment, determinism, speed
sensitivity, post-accum monotonicity, existing-caller compat, textless
scene skipped from drift). Run green, delete. Don't commit.

## TransitionSeries overlap desync (pipeline 3 → render)

Distinct from everything above — this bug is in
`engine/pipeline3/StoryboardVideo.jsx`, not in the voiceover path.
Symptoms look like pipeline-1 timing issues ("scenes not on time", "sfx
fires after scene-end", "TTS doesn't sync with the visual scene"), but
the fix lives in pipeline 3 because the violation is between Remotion's
`<TransitionSeries>` overlap behaviour and pipeline-1's contiguous
partition.

### Mechanism

`<TransitionSeries.Transition>` between two sequences overlaps them —
Remotion shifts the entering scene *backward in time* so both scenes
render simultaneously during the transition window. Per Remotion's
TransitionSeries docs:

> "It shifts the next scene backward in time so both scenes render
> simultaneously during the transition window"
>
> "It shortens the total duration because both scenes overlap during
> the transition"

So the crossfade is **T = TRANSITION_DURATION_FRAMES** frames of overlap
on top of the contiguous Σ_durations, not a pure gap-insert. The
pre-fix code in `StoryboardVideo.jsx` did:

- per scene: `fromFrame = Math.round(startSec * fps)` (independent, not cumulative),
- per scene: `durationInFrames = Math.round((endSec - startSec) * fps)` (raw, no transition correction),
- per sfx: `from = Math.round(s.atSec * fps)` (raw endSec × fps).

Because Remotion's backward-shift pulls scene N+1's frame-zero to
`Σ_durations_so_far - priorTransitions × T`, the per-scene
`Math.round(startSec*fps)` and Remotion's actual frame-zero diverge by
`priorTransitions × T` (cumulative — every prior transition contributes).
Two compounding symptoms:

1. **Visuals ahead of audio.** Since `<Audio>` plays linearly from
   frame 0 while the visual scene N+1 starts at `remotionFrameZero =
   Math.round(startSec_{N+1} * fps) - priorTransitions × T`, the visual
   scene is `priorTransitions × T` frames AHEAD of its voiceover. At
   30 fps with T = 15, scene N's visual leads its audio by `(N-1) ×
   0.5s`. On a 10-scene storyboard the last scene's visual starts ~4.5s
   before its voiceover.
2. **SFX late on scene-end.** SFX placed at `Math.round(atSec * fps) =
   Math.round(endSec * fps)` lands on the raw pipeline-1 boundary frame.
   But the previous scene's visual CONTENT actually ended `T` frames
   earlier (the crossfade ate its tail — scene N+1 was already
   rendering during scene N's last T frames). So the sfx fires T frames
   AFTER the scene visually crossfaded into the next one — feels
   detached from the scene-end it was supposed to punctuate. The drift
   also compounds: each N+1 scene's sfx is `priorTransitions × T`
   frames late relative to where its visual landed.

### Fix (in `engine/pipeline3/StoryboardVideo.jsx`)

Extend every scene with an outgoing transition by T frames in its
`<TransitionSeries.Sequence durationInFrames>`. Then Remotion's
backward-pull lands scene N+1's frame-zero at:

```
scene_i.remotionFrameZero = Σ_durations_before_i - priorTransitions_i × T
                          ≈ Math.round(startSec_i * fps)   (within 1 frame rounding)
```

by construction. Compute `fromFrame` as a cumulative offset that
explicitly subtracts `transitionsBefore × T` (don't use independent
`Math.round(startSec*fps)` per scene — that re-introduces per-scene
rounding drift that compounds because Remotion's frame-zero uses
Σ_durations, not the per-scene float). A `Math.max(1, …)` floor guards
short scenes (Remotion requires positive integer `durationInFrames`).

For SFX, build a `visualEndFrameBySceneId` map:
`scene.remotionFrameZero + rawDuration` (rawDuration is the scene's
pipeline-1 budget BEFORE the T-frame extension — the actual content
length). Place each sfx at its scene's visual-end frame instead of
`Math.round(atSec * fps)`. Fall back to `Math.round(atSec * fps)` for
scenes with no entry in the map (e.g. trailing scene whose visual end
== endSec × fps within rounding).

### Verification recipe (model Remotion's overlap inline)

The repo has no `npm test` and Remotion isn't importable in pure Node
without its bundler, so verify the timing math by replicating
`StoryboardVideo.jsx`'s computation IN a throwaway script, modelling
Remotion's `Σ_durations - priorTransitions × T` behaviour inline:

```js
// /tmp/hermes-verify-<suffix>.mjs
import { readFileSync } from "node:fs";
const T = 15;
const input = JSON.parse(readFileSync(
  new URL("file:///abs/path/to/dist/output/render-input.json"), "utf8"));
const { fps, scenes, sfx, totalDurationSec } = input;
const hasOutgoing = scenes.map((_, i) => i < scenes.length - 1);
const sceneFrames = scenes.map((s, i) => {
  const rawDuration = Math.round((s.timing.endSec - s.timing.startSec) * fps);
  const transitionExt = hasOutgoing[i] ? T : 0;
  return { sceneId: s.sceneId, startSec: s.timing.startSec,
           rawDuration, durationInFrames: Math.max(1, rawDuration + transitionExt) };
});
let cursor = 0, transitionsBefore = 0;
for (const f of sceneFrames) {
  f.remotionFrameZero = cursor - transitionsBefore * T;
  cursor += f.durationInFrames;
  if (transitionsBefore < sceneFrames.length - 1) transitionsBefore++;
}
const total = cursor - transitionsBefore * T;
// assertions:
assert(Math.abs(total - Math.round(totalDurationSec * fps)) <= scenes.length);  // 1
for (const f of sceneFrames)
  assert(Math.abs(f.remotionFrameZero - Math.round(f.startSec * fps)) <= 1);    // 2
// 3. SFX fires at scene.visualEnd == remotionFrameZero + rawDuration
```

Pitfall: `new URL(absPath)` throws `ERR_INVALID_URL` for bare absolute
paths. Use the `file://` scheme: `new URL("file:///abs/path")` or
`pathToFileURL(absPath).href`. Caught when the first verifier run threw
on a `/home/...` argument.

Three assertions are the load-bearing ones (must all pass):

1. Rendered total `Σ_durations - priorTransitions × T ≈ round(totalDurationSec
   × fps)` (within `scenes.length`-frame slack — each scene loses ≤1
   frame to rounding).
2. Every scene's `remotionFrameZero ≈ round(startSec × fps)` (within 1
   frame) — proves the backward-shift lands scenes on their pipeline-1
   start. Pre-fix this drifted `priorTransitions × T` frames (15/30/45
   on a 3-scene storyboard at 30 fps).
3. Every SFX's frame == its scene's `visualEndFrame` (within 1 frame) —
   proves sfx sits on the perceived scene-end, not T×priorTransitions
   frames late. Map per scene:
   `visualEndFrame = remotionFrameZero + rawDuration`.

Plus the trivial: every `durationInFrames >= 1` (floor guard).

Verified against a real `dist/output/render-input.json` from a prior run
(3 scenes, fps=30, totalDurationSec=8.09, T=15):

```
PASS: Rendered total (242 = Σdur 272 - 2×T 30) ≈ totalDurationSec*fps (243), drift=1f
PASS: Every scene's Remotion frame-zero matches startSec*fps within ≤1f (max observed drift 0f)
  sfx "scene-1": visualEnd=72f, rawEndSec*fps=72f, saved=0f
  sfx "scene-2": visualEnd=128f, rawEndSec*fps=128f, saved=0f
  sfx "scene-3": visualEnd=242f, rawEndSec*fps=243f, saved=1f
PASS: Every scene has positive durationInFrames (floor(1) satisfied)
```

### Caveats / what this verifier does NOT prove

- **Remotion's runtime behaviour is modelled inline, not exercised.
  Pure-Node verification models `Σ_durations - priorTransitions × T`
  per the docs. If `@remotion/transitions` ever changes its overlap
  semantics (e.g. starts shortening by 2×T, or shifts only the first
  transition), this verifier won't catch it — the math will look green
  while Remotion renders wrong.** Only a real `node main.js` end-to-end
  render (Kyutai TTS server at `localhost:8000/tts` + faster-whisper in
  `engine/pipeline1/.venv` + headless Chrome) actually exercises the
  `TransitionSeries` runtime. The inline-verifier is a fast early gate
  for the math; it is NOT a render-pass replacement.
- **Per-scene rounding slack** — the test tolerance is `≤ scenes.length`
  frames for the total and `≤ 1` frame per scene boundary. At 30 fps
  that's ≤ 33 ms per scene, ≤ N×33 ms total. Below human perception for
  N ≤ ~20.
- **`Math.round(startSec*fps)` per scene is a trap.** The natural
  alternative to cumulative offsets is per-scene `round(startSec*fps)`
  for `fromFrame`, but that independently rounds each boundary AND
  ignores the transition overlap entirely. It drifts by `priorTransitions
  × T` frames AND by per-scene rounding. Cumulative offsets over the
  extended durations are the only correct shape.

### Layout note: extend, don't subtract

Two earlier wrong variants during the fix iteration (both thrown away
before commit):

- **Subtract T from each non-last scene's duration** (give the tail to
  the crossfade): scene N+1's frame-zero lands at `Σ_durations_so_far -
  transitionsBefore × T` where each non-last scene shrunk by T — i.e.
  scene N+1 enters `priorTransitions × T` frames BEFORE its startSec.
  Visuals-ahead-of-audio drift doubled.
- **Subtract T from BOTH sides** (outgoing scene donates + entering
  scene shifts forward): timeline collapsed by `2T` per transition,
  last scene ran out `priorTransitions × T` frames before the audio
  ended.

The correct shape is **ADD T to each non-last scene's durationInFrames
only**. Remotion's backward-shift then re-aligns scenes with their
startSec, and the total compressed duration `Σ_durations -
priorTransitions × T` equals `round(totalDurationSec * fps)` within
rounding.
