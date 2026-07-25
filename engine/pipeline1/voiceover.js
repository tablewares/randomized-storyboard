import path from "node:path";
import { synthesizeVoice } from "./kyutai_tts.js";
import { alignAudioWords, alignStoryboardToTranscript } from "./whisperAlign.mjs";

const WORDS_PER_SECOND = 150 / 60;

/**
 * Signature for the already-implemented TTS + whisperX captioning +
 * forced-alignment function. Pipeline 1 does not implement this itself; it
 * is injected so this engine stays decoupled from the specific TTS/ASR
 * stack in use.
 *
 * Expected behavior (already built elsewhere):
 *   1. Concatenate all segment texts in order into one utterance.
 *   2. Synthesize it with the given voice config.
 *   3. Run whisperX over the resulting audio to get word/segment captions.
 *   4. Match captions back against the original per-segment text to recover
 *      a rough start/end timespan for each input segment.
 *   5. Return those timespans (seconds) plus the path to the rendered audio.
 *
 * @typedef {(segments: VoiceoverSegment[], voice: import("../../types.js").VoiceConfig) => Promise<VoiceoverAlignmentResult>} TtsAlignFn
 */

/**
 * @param {VoiceoverSegment[]} segments
 * @param {import("../../types.js").VoiceConfig} voice
 * @param {TtsAlignFn} ttsAlignFn
 * @returns {Promise<{audioPath: string, sceneTimings: import("../../types.js").SceneTiming[]}>}
 */
export async function synthesizeAndAlign(segments = [], options = {}) {
  const { 
    workDir, 
    voice, 
    alignment = {}, 
    speed = 1,
    WORDS_PER_SECOND = 2.5 
  } = options;

  let sceneTimings = [];
  let audioPath = null;

  // --- PATH 1: Dynamic Synthesis + WhisperX Alignment ---
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

    let sceneEndTimes = [];

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
      sceneEndTimes = alignStoryboardToTranscript(sceneTexts, transcriptWords, {
        onLowConfidence: ({ matchRatio, matchedCount, totalTokens }) => {
          console.warn(
            `  ⚠ Storyboard/transcript alignment matched only ${(matchRatio * 100).toFixed(1)}% of words ` +
            `(${matchedCount}/${totalTokens}). Scene boundaries may be unreliable — check TTS pronunciation vs storyboard text.`
          );
        },
      }) || [];
    }

    // 3. Transform aligned end times back into timing records
    let currentStart = 0;
    sceneTimings = segments.map((segment, index) => {
      const start = currentStart;
      const end = sceneEndTimes[index] !== undefined ? sceneEndTimes[index] : currentStart;
      currentStart = end;

      return {
        ...segment, // Retains id, text, type, and any metadata (subtitles, overrides, etc.)
        sceneId: segment.id,
        startSec: start,
        endSec: end,
        start,
        end,
      };
    });

  } else {
    // --- PATH 2: Fallback Naive Estimation (No workDir provided) ---
    console.log("  · workDir not provided — falling back to WPM estimate.");
    let cursor = 0;

    sceneTimings = segments.map((segment) => {
      const wordCount = (segment.text || "").trim().split(/\s+/).filter(Boolean).length;
      const durationSeconds = Math.max(wordCount / (WORDS_PER_SECOND * speed), 0.5);
      const start = cursor;
      const end = cursor + durationSeconds;
      cursor = end;

      return {
        ...segment,
        sceneId: segment.id,
        startSec: start,
        endSec: end,
        start,
        end,
      };
    });
  }

  return { 
    audioPath, 
    sceneTimings 
  };
}