// src/utils/whisperAlign.mjs
//
// Support for "single-pass" voice synthesis: instead of calling the TTS
// engine once per scene, the caller concatenates every scene's voiceover
// text, synthesizes it as ONE audio file, and inserts that single file as
// the audio track for the whole video (no per-scene splitting/re-synthesis).
//
// To recover per-scene durations from that single file, we transcribe it
// with faster-whisper and align the storyboard's own voiceover text against
// the transcript of what was *actually spoken* — not against a second,
// separately-synthesized copy of the text (comparing synthesis-to-synthesis
// tells you nothing about what the TTS engine actually produced; comparing
// storyboard-text-to-transcript does).
//
// Requires:
//   - `faster-whisper` in the target venv (pip install faster-whisper)
//
// Previously this shelled out to WhisperX. faster-whisper (CTranslate2)
// gives the same kind of word-level timestamps WhisperX's forced-alignment
// pass does, but without needing WhisperX's much heavier PyTorch/pyannote
// dependency stack — smaller install, faster cold start, lower memory per
// job. See fasterWhisperTranscribe.py, the helper script this now shells
// out to instead of `python -m whisperx`.
//
// NOTE: this changes the *engine* producing the timestamps, not just how
// it's called. The shape returned by alignAudioWords() below — and
// everything downstream in alignStoryboardToTranscript() — is unchanged,
// but exact word boundaries will differ slightly from what WhisperX
// produced, since it's a different model runtime with its own decoding.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSCRIBE_SCRIPT = path.join(__dirname, "fasterWhisperTranscribe.py");

/**
 * Runs faster-whisper on an audio file and returns a flat, time-ordered
 * list of word-level timestamps: [{ word, start, end }, ...]
 */
export async function alignAudioWords(
  audioPath,
  { workDir, model = "small", language = "en", device = "cpu", computeType } = {}
) {
  const isWindows = process.platform === "win32";

  // Dynamically construct the path to the python executable
  const pythonPath = isWindows
    ? path.join(workDir, ".venv", "Scripts", "python.exe")
    : path.join(workDir, ".venv", "bin", "python");

  // The helper script prints the word list as JSON on stdout, so unlike
  // the old WhisperX call there's no output directory/file to manage.
  const { stdout } = await execFileAsync(
    pythonPath,
    [
      TRANSCRIBE_SCRIPT,
      audioPath,
      "--model", model,
      "--language", language,
      "--device", device,
      "--compute_type", computeType || (device === "cpu" ? "int8" : "float16"),
    ],
    { maxBuffer: 1024 * 1024 * 64 }
  );

  const parsed = JSON.parse(stdout);

  const words = [];
  for (const w of parsed.words || []) {
    if (typeof w.start === "number" && typeof w.end === "number" && w.word) {
      words.push({ word: w.word.trim(), start: w.start, end: w.end });
    }
  }
  return words;
}

function normalizeToken(word) {
  return (word || "").toLowerCase().replace(/[^a-z0-9']/g, "");
}

function tokenize(text) {
  return (text || "").trim().split(/\s+/).filter(Boolean);
}

/**
 * Aligns two normalized token sequences via longest-common-subsequence
 * dynamic programming and returns the matched index pairs, in order.
 *
 * O(n*m) time, but only O(m) + O(n*m) *bytes* of space rather than the
 * (n+1)*(m+1) table of 32-bit counts a naive implementation needs: the
 * forward pass only ever looks at the current and previous row of lengths,
 * so those are kept in two reused Uint32Arrays, while the only thing kept
 * per-cell for the traceback is a 1-byte direction code (diag/up/left) in a
 * flat Uint8Array. That's a ~4x memory cut vs. storing full 32-bit lengths
 * everywhere, with far better cache locality, and it produces byte-identical
 * results to the original full-table version (same recurrence, same
 * dp[i-1][j] >= dp[i][j-1] tie-break, just computed and stored differently).
 *
 * For scripts long enough that O(n*m) bytes is still too much, a
 * banded/Hirschberg-style alignment would be the next step, but that
 * changes which of several equally-optimal alignments gets picked when
 * there are ties (e.g. repeated words), so it isn't a safe drop-in here.
 */
function alignTokenSequences(aTokens, bTokens) {
  const n = aTokens.length;
  const m = bTokens.length;

  const DIAG = 0;
  const UP = 1;
  const LEFT = 2;
  const dir = new Uint8Array(n * m);

  let prev = new Uint32Array(m + 1);
  let curr = new Uint32Array(m + 1);

  for (let i = 1; i <= n; i += 1) {
    const rowBase = (i - 1) * m;
    const a = aTokens[i - 1];
    for (let j = 1; j <= m; j += 1) {
      if (a === bTokens[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        dir[rowBase + (j - 1)] = DIAG;
      } else if (prev[j] >= curr[j - 1]) {
        curr[j] = prev[j];
        dir[rowBase + (j - 1)] = UP;
      } else {
        curr[j] = curr[j - 1];
        dir[rowBase + (j - 1)] = LEFT;
      }
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
    curr.fill(0);
  }

  const matches = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const d = dir[(i - 1) * m + (j - 1)];
    if (d === DIAG) {
      matches.push({ aIndex: i - 1, bIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (d === UP) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  matches.reverse();
  return matches;
}

/**
 * Aligns the storyboard's own per-scene voiceover text against the WhisperX
 * transcript of the combined audio, and returns one cumulative end-time (in
 * seconds, into the combined audio) per scene — i.e. where each scene's
 * speech actually finishes, according to what was actually spoken.
 *
 * `transcriptWords` — WhisperX word list for the combined audio (see
 * alignAudioWords). `sceneVoiceoverTexts` — storyboard voiceover strings,
 * in scene order (same strings that were concatenated for synthesis).
 */
export function alignStoryboardToTranscript(sceneVoiceoverTexts, transcriptWords, { onLowConfidence } = {}) {
  const sceneTokenCounts = sceneVoiceoverTexts.map((t) => tokenize(t).length);
  const storyboardTokens = sceneVoiceoverTexts.flatMap((t) => tokenize(t)).map(normalizeToken);
  const transcriptTokens = transcriptWords.map((w) => normalizeToken(w.word));

  const matches = alignTokenSequences(storyboardTokens, transcriptTokens);
  const matchRatio = storyboardTokens.length > 0 ? matches.length / storyboardTokens.length : 1;
  if (matchRatio < 0.6) {
    onLowConfidence?.({ matchRatio, matchedCount: matches.length, totalTokens: storyboardTokens.length });
  }

  const matchMap = new Array(storyboardTokens.length).fill(-1);
  for (const { aIndex, bIndex } of matches) matchMap[aIndex] = bIndex;

  // For a storyboard token with no direct transcript match (TTS mispronounced
  // it, WhisperX misheard it, etc.), fall back to the nearest matched
  // neighbor — preferring to look backward, since we want an "end of speech
  // so far" boundary.
  const resolveTime = (tokenIndex) => {
    for (let k = tokenIndex; k >= 0; k -= 1) {
      if (matchMap[k] !== -1) return transcriptWords[matchMap[k]].end;
    }
    for (let k = tokenIndex + 1; k < matchMap.length; k += 1) {
      if (matchMap[k] !== -1) return transcriptWords[matchMap[k]].start;
    }
    return null;
  };

  const sceneEndTimes = [];
  let cursor = 0;
  let lastEnd = 0;
  for (const count of sceneTokenCounts) {
    let endTime;
    if (count === 0) {
      endTime = lastEnd;
    } else {
      const lastTokenIdx = cursor + count - 1;
      endTime = resolveTime(lastTokenIdx);
      if (endTime === null) endTime = lastEnd;
    }
    // Boundaries must be monotonically non-decreasing along the single
    // audio track — guard against any local mis-ordering from the alignment.
    endTime = Math.max(endTime, lastEnd);
    sceneEndTimes.push(endTime);
    lastEnd = endTime;
    cursor += count;
  }

  return sceneEndTimes;
}
