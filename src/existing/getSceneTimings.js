import path from "node:path";
import { synthesizeVoice } from "./kyutai_tts.js";
import { alignAudioWords, alignStoryboardToTranscript } from "./whisperAlign.mjs";

const WORDS_PER_SECOND = 150 / 60;

/**
 * Calculates scene timings either using actual TTS + WhisperX transcript alignment 
 * (if `config.workDir` is provided) or falling back to a WPM-based estimate.
 *
 * @param {Array<Object>} voiceoverSegments - Array of objects with `{ id, text, type, ... }`
 * @param {Object} [voiceConfig={}] - Voice parameters or general timing configuration.
 * @param {string} [voiceConfig.workDir] - Directory for intermediate files. Required to trigger dynamic alignment.
 * @param {Object} [voiceConfig.voice] - Specific voice configuration parameters passed to `synthesizeVoice`.
 * @param {Object} [voiceConfig.alignment] - WhisperX options (model, language, device, compute_type).
 * @returns {Promise<Array<{ id: string, start: number, end: number, text: string, type: string }>>}
 */
export async function getSceneTimings(voiceoverSegments = [], voiceConfig = {}) {
  // Destructure config properties while supporting both legacy voiceConfig structures and workDir params
  const {  workDir, voice, alignment = {}, speed = 1 } = voiceConfig;
  console.log("voiceconfig", voiceConfig)

  // --- PATH 1: Dynamic Synthesis + WhisperX Alignment ---
  if (workDir) {
    const resolvedWorkDir = path.resolve(workDir);
    console.log("workdir", resolvedWorkDir);
    const pythonpath = path.join(resolvedWorkDir, "src", "existing")
    // Extract raw text strings for full text synthesis and storyboard alignment
    const sceneTexts = voiceoverSegments.map((segment) => segment.text || "");
    const fullText = sceneTexts.join(" ");

    console.log("\n→ Single-pass voice synthesis enabled — synthesizing single combined text...");
    const combinedAudioOut = path.join(resolvedWorkDir, "combined_voice.mp3");

    // 1. Synthesize combined audio file
    await synthesizeVoice({
      text: fullText,
      voice,
      outPath: combinedAudioOut,
    });

    let sceneEndTimes = [];

    // 2. Perform WhisperX transcript alignment
    if (sceneTexts.length > 0) {
      console.log("  · Transcribing combined voice track with WhisperX...");
      const transcriptWords = await alignAudioWords(combinedAudioOut, {
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

    // 3. Transform aligned end times back into the standard `getSceneTimings` output contract
    let currentStart = 0;
 
    return voiceoverSegments.map((segment, index) => {
      // Use the aligned end time or default to current start if unavailable
      const end = sceneEndTimes[index] !== undefined ? sceneEndTimes[index] : currentStart;
      const start = currentStart;
      currentStart = end;
      return {
        id: segment.id,
        start,
        end,
        text: segment.text,
        type: segment.type,
      };
    });
  }

  // --- PATH 2: Fallback Naive Estimation (No workDir provided) ---
  console.log("  · workDir not provided — falling back to WPM estimate.");
  let cursor = 0;

  return voiceoverSegments.map((segment) => {
    const wordCount = (segment.text || "").trim().split(/\s+/).filter(Boolean).length;
    const durationSeconds = Math.max(wordCount / (WORDS_PER_SECOND * speed), 0.5);
    const start = cursor;
    const end = cursor + durationSeconds;
    cursor = end;

    return {
      id: segment.id,
      start,
      end,
      text: segment.text,
      type: segment.type,
    };
  });
}