import path from "node:path";
import { synthesizeVoice, getAudioDurationSec } from "./kyutai_tts.js";
import { alignAudioWords, alignStoryboardToTranscript } from "./whisperAlign.mjs";

/**
 * Default speech rate used by the no-workDir fallback path (Path 2).
 * 150 words/minute ≈ 2.5 words/second. Kept as a real module constant
 * rather than a destructured-with-defaults local — the destructure was
 * only used in Path 1's scope and never read there, which made the
 * "configurable WPM" story misleading (Path 1 ignores it entirely because
 * it measures real audio, not estimates from WPM).
 */
const DEFAULT_WORDS_PER_SECOND = 150 / 60;

/**
 * Optional minimum trailing pad (seconds) added on top of the last matched
 * word's end when the final scene's recovered end is shorter than the real
 * audio duration. Keeps the last consonant/breath from being clipped by the
 * frame boundary at endSec*fps even when ffprobe reports the audio is a hair
 * longer than the last whisper word's `end`. The clamp itself (endSec =
 * audioDurationSec) is the important fix; this pad is a belt-and-suspenders
 * guard against ffprobe/whisper clock skew.
 */
const TAIL_PAD_SEC = 0.05;

/**
 * Per-scene end buffer (seconds) added to EVERY scene's recovered endSec in
 * BOTH paths. Absorbs two accumulation-friendly sources of drift between
 * a scene boundary and the real TTS audio:
 *
 *   1. Frame-rounding error at the Remotion boundary — `Math.round(endSec *
 *      fps)` in StoryboardVideo.jsx can lose up to ~0.5/fps seconds per
 *      scene (at 30fps ≈ 16ms). It is *systematic* (round always lands on
 *      an integer frame) and compounds across scenes whose start is
 *      computed as the previous scene's rounded end.
 *   2. Small per-scene TTS pacing drift — whisper's last-word `end` for a
 *      scene typically lands a few frames before the next scene's first
 *      word actually begins (breath gap, consonant decay), so using the
 *      raw `aligned.end` as the next scene's start makes the next scene's
 *      visual animation fire a hair early relative to its voiceover.
 *
 * Because the next scene's `start = prevEnd` (see the Path 1 loop below),
 * extending `end` by this buffer makes the buffer part of the contiguous
 * timeline — i.e. the next scene starts SCENE_END_BUFFER_SEC later than
 * the raw aligned boundary — rather than inserting a silent gap into the
 * audio (the <Audio> element plays the full mp3 regardless). Tunable via
 * `voicecfg.sceneEndBufferSec`; set to 0 to disable.
 */
const SCENE_END_BUFFER_SEC = 0.08;

/**
 * Per-scene accumulation pad (seconds) added in Path 2 (the WPM fallback)
 * ONLY. The WPM estimate has no real audio to anchor it, so its per-scene
 * duration error compounds scene-over-scene: if scene 1 is 100ms longer in
 * real TTS than the WPM estimate predicted, every later scene's absolute
 * startSec shifts by 100ms even though the engine trusts it blindly
 * downstream. Biasing each estimated duration slightly long builds cumulative
 * headroom so the recovered startSec of later scenes lags the real audio
 * rather than running ahead of it (a lag is recoverable; running ahead
 * desyncs visuals from voiceover). Tunable via
 * `voicecfg.accumulationPadPerSceneSec`; set to 0 to disable.
 */
const ACCUMULATION_PAD_PER_SCENE_SEC = 0.12;

/**
 * Entry point for pipeline 1's voiceover stage.
 *
 * Two paths:
 *   - PATH 1 (workDir provided): synthesizes the concatenated scene text as
 *     a single audio file, transcribes it with faster-whisper, then aligns
 *     the storyboard's own per-scene text against that transcript to recover
 *     *accurate* per-scene {start, end} timestamps directly from what was
 *     actually spoken. Scene starts come from the first matched word's
 *     `start`, ends from the last matched word's `end`, and the final scene's
 *     end is clamped to the real synthesised-audio duration (read via
 *     ffprobe) so trailing audio is never cut short by a frame boundary at
 *     endSec*fps.
 *   - PATH 2 (no workDir): naive WPM estimate — no TTS, no transcription.
 *     Used for tests/dry-runs that only want timing-shaped data.
 *
 * Accumulation buffer: every scene's `endSec` is padded by
 * `sceneEndBufferSec` (default SCENE_END_BUFFER_SEC) before becoming the
 * next scene's `start`, so a small breathing room is inserted between the
 * raw aligned/estimated scene boundary and where the next scene's visual
 * fires. Path 2 additionally adds `accumulationPadPerSceneSec` per scene
 * to keep its un-anchored estimate from running ahead of real TTS. Both
 * are tunable via `voicecfg`.
 *
 * @param {Array<{id: string, text: string}>} segments
 * @param {Object} options
 * @param {string} [options.workDir] - project root; enables Path 1 (real synthesis + alignment)
 * @param {import("../types.js").VoiceConfig} [options.voice]
 * @param {{model?: string, language?: string, device?: string, compute_type?: string}} [options.alignment]
 * @param {number} [options.speed] - Path 2 only; speech rate multiplier
 * @param {number} [options.WORDS_PER_SECOND] - Path 2 only; overrides default WPM rate
 * @param {number} [options.sceneEndBufferSec] - overrides SCENE_END_BUFFER_SEC (both paths). Set 0 to disable.
 * @param {number} [options.accumulationPadPerSceneSec] - overrides ACCUMULATION_PAD_PER_SCENE_SEC (Path 2 only)
 * @returns {Promise<{audioPath: string|null, sceneTimings: Array<{sceneId: string, startSec: number, endSec: number, start: number, end: number}>}>}
 */
export async function synthesizeAndAlign(segments = [], options = {}) {
  const {
    workDir,
    voice,
    alignment = {},
    speed = 1,
    WORDS_PER_SECOND = DEFAULT_WORDS_PER_SECOND,
    sceneEndBufferSec = SCENE_END_BUFFER_SEC,
    accumulationPadPerSceneSec = ACCUMULATION_PAD_PER_SCENE_SEC,
  } = options;

  const sceneTimings = [];
  let audioPath = null;

  // --- PATH 1: Real Synthesis + WhisperX Alignment ------------------------
  if (workDir) {
    const resolvedWorkDir = path.resolve(workDir);
    const pythonpath = path.join(resolvedWorkDir, "engine", "pipeline1");

    // Extract raw text strings for full text synthesis and storyboard alignment
    const sceneTexts = segments.map((segment) => segment.text || "");
    const fullText = sceneTexts.join(" ");

    console.log("\n→ Single-pass voice synthesis enabled — synthesizing single combined text...");
    audioPath = path.join(resolvedWorkDir, "combined_voice.mp3");

    // 1. Synthesize combined audio file
    await synthesizeVoice({
      text: fullText,
      voice,
      outPath: audioPath,
    });

    // Measure the *actual* synthesized audio length up front. This is the
    // ground-truth total duration we must respect — clamping the last scene's
    // endSec here is what stops Remotion from cutting the TTS tail off.
    let audioDurationSec = null;
    try {
      audioDurationSec = await getAudioDurationSec(audioPath);
    } catch (err) {
      // ffprobe missing or audio unreadable — log and fall back to aligning
      // strictly to whisper boundaries (the old behaviour). Better to keep
      // rendering than to hard-fail on optional tooling.
      console.warn(
        `  ⚠ Could not measure audio duration via ffprobe (${err.message}). ` +
        `Last-scene tail may be clipped if whisper timestamps end early.`
      );
    }

    let sceneBoundaries = [];
    // 2. Perform WhisperX transcript alignment
    if (sceneTexts.length > 0) {
      console.log("  · Transcribing combined voice track with WhisperX...");
      const transcriptWords = await alignAudioWords(audioPath, {
        workDir: pythonpath,
        model: alignment.model || "small",
        language: alignment.language || "en",
        device: alignment.device || "cpu",
        computeType: alignment.compute_type || "int8",
      });

      console.log("  · Aligning storyboard text against transcript to recover scene boundaries...");
      sceneBoundaries = alignStoryboardToTranscript(sceneTexts, transcriptWords, {
        onLowConfidence: ({ matchRatio, matchedCount, totalTokens }) => {
          console.warn(
            `  ⚠ Storyboard/transcript alignment matched only ${(matchRatio * 100).toFixed(1)}% of words ` +
            `(${matchedCount}/${totalTokens}). Scene boundaries may be unreliable — check TTS pronunciation vs storyboard text.`
          );
        },
      }) || [];
    }

    // 3. Transform aligned {start,end} boundaries into timing records.
    //
    // Guarantees this enforces (alignStoryboardToTranscript already enforces
    // monotonicity per-scene, but we re-clamp here so the final record set is
    // robust even if alignment was skipped/empty):
    //   - first scene starts at 0 (audio begins at t=0; we don't want a
    //     "scene 1 starts at 0.4s because that's where its first word was"
    //     — the audio track begins at 0 and so should the video's first frame),
    //   - every scene's start == previous scene's end (continuous audio => no
    //     gaps, no overlaps — scenes are sequential partitions of one track),
    //   - every scene's end is padded by `sceneEndBufferSec` before becoming
    //     the next scene's start — a small breathing room between the raw
    //     aligned boundary and where the next visual fires, absorbing frame
    //     rounding error and whisper breath-gap skew (see SCENE_END_BUFFER_SEC
    //     doc above),
    //   - last scene's end is clamped up to audioDurationSec + TAIL_PAD_SEC so
    //     the TTS tail (trailing breath, final consonant decay, tail silence
    //     added by the TTS engine) is never cut by a frame boundary at endSec*fps,
    //   - every scene has end > start (no zero/negative-duration scenes).
    let prevEnd = 0;
    sceneTimings.length = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      const aligned = sceneBoundaries[i] || { start: null, end: null };

      let start = prevEnd;
      let end = aligned.end ?? prevEnd;

      // First scene always starts at 0: the audio track begins at t=0, so
      // the video's first frame must too, regardless of where the first
      // spoken word actually lands.
      if (i === 0) start = 0;

      // Monotonic, non-overlapping, non-negative-duration.
      start = Math.max(start, 0);
      end = Math.max(end, start);
      if (i > 0) start = Math.max(start, prevEnd);

      // Accumulation buffer: pad this scene's end so the next scene's
      // start (= prevEnd) sits `sceneEndBufferSec` after the raw aligned
      // boundary. Applied to every scene except the last (the last scene's
      // end is handled by the ffprobe tail clamp below, which already
      // accounts for TTS tail length). For non-last scenes the buffer
      // becomes part of the contiguous timeline (no silent gap: the <Audio>
      // element plays the full mp3, scenes partition it).
      if (i < segments.length - 1) {
        end = end + sceneEndBufferSec;
      }

      prevEnd = end;
      sceneTimings.push({
        ...segment, // Retains id, text, type, and any metadata (subtitles, overrides, etc.)
        sceneId: segment.id,
        startSec: start,
        endSec: end,
        start,
        end,
      });
    }

    // 4. Clamp the last scene's end to the real audio duration so we never
    // cut the TTS tail. Without this, if the last word's recovered `end` is
    // ~200-500ms shorter than the actual mp3 (whisper tends to end the last
    // word slightly before the file's true end), Remotion's last
    // TransitionSeries.Sequence gets a durationInFrames = round(endSec*fps)
    // that stops short — and even though <Audio> keeps playing, the visual
    // sequence ends, so the rendered mp4 is truncated to endSec. Clamping
    // endSec up to audioDurationSec makes the last scene's frame span the
    // entire real audio including tail. The per-scene `sceneEndBufferSec`
    // is NOT applied to the last scene here because the tail clamp is the
    // authoritative extension for that scene.
    if (sceneTimings.length > 0 && audioDurationSec && Number.isFinite(audioDurationSec)) {
      const last = sceneTimings[sceneTimings.length - 1];
      const clampedEnd = Math.max(last.endSec, audioDurationSec + TAIL_PAD_SEC);
      if (clampedEnd > last.endSec) {
        last.endSec = clampedEnd;
        last.end = clampedEnd;
      }
    }

  } else {
    // --- PATH 2: Fallback Naive Estimation (No workDir provided) ----------
    console.log("  · workDir not provided — falling back to WPM estimate.");
    let cursor = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const wordCount = (segment.text || "").trim().split(/\s+/).filter(Boolean).length;
      const durationSeconds = Math.max(wordCount / (WORDS_PER_SECOND * speed), 0.5);
      const start = cursor;
      // Path 2 has no real audio to anchor it, so per-scene WPM error
      // accumulates scene-over-scene. Bias each estimated duration slightly
      // long: the accumulation pad plus the same end buffer used in Path 1.
      // The end buffer keeps timings consistent across the two paths; the
      // accumulation pad is the extra headroom that only this un-anchored
      // estimate needs.
      const end = cursor + durationSeconds + sceneEndBufferSec + accumulationPadPerSceneSec;
      cursor = end;

      sceneTimings.push({
        ...segment,
        sceneId: segment.id,
        startSec: start,
        endSec: end,
        start,
        end,
      });
    }
  }

  return {
    audioPath,
    sceneTimings,
  };
}

