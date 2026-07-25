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
 * @param {Array<{id: string, text: string}>} segments
 * @param {Object} options
 * @param {string} [options.workDir] - project root; enables Path 1 (real synthesis + alignment)
 * @param {import("../types.js").VoiceConfig} [options.voice]
 * @param {{model?: string, language?: string, device?: string, compute_type?: string}} [options.alignment]
 * @param {number} [options.speed] - Path 2 only; speech rate multiplier
 * @param {number} [options.WORDS_PER_SECOND] - Path 2 only; overrides default WPM rate
 * @returns {Promise<{audioPath: string|null, sceneTimings: Array<{sceneId: string, startSec: number, endSec: number, start: number, end: number}>}>}
 */
export async function synthesizeAndAlign(segments = [], options = {}) {
  const {
    workDir,
    voice,
    alignment = {},
    speed = 1,
    WORDS_PER_SECOND = DEFAULT_WORDS_PER_SECOND,
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
    //   - last scene's end is clamped up to audioDurationSec so the TTS tail
    //     (trailing breath, final consonant decay, tail silence added by the
    //     TTS engine) is never cut by a frame boundary at endSec*fps,
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
    // entire real audio including tail.
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

    for (const segment of segments) {
      const wordCount = (segment.text || "").trim().split(/\s+/).filter(Boolean).length;
      const durationSeconds = Math.max(wordCount / (WORDS_PER_SECOND * speed), 0.5);
      const start = cursor;
      const end = cursor + durationSeconds;
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
