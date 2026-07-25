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

## tuning knobs

- `alignment.{model, language, device, compute_type}` — passed through to
  `fasterWhisperTranscribe.py`. Defaults: model `small`, language `en`,
  device `cpu`, compute_type `int8` (or `float16` when device != cpu).
- `speed` / `WORDS_PER_SECOND` (Path 2 only) — WPM-estimate fallback.
- `TAIL_PAD_SEC = 0.05` (Path 1, `voiceover.js`) — belt-and-suspenders pad
  added to the audio-duration clamp, guards against ffprobe/whisper clock
  skew. Bump it if the very final consonant is still clipped.
- The `voicecfg` object in `storyboard.config.json` is passed verbatim as
  `synthesizeAndAlign`'s `options` argument — anything you add there (e.g.
  `speed`, `WORDS_PER_SECOND`, `alignment`) flows through.
