import { getSceneTimings } from "../existing/getSceneTimings.js";
import { FPS } from "../config.js";

/**
 * Converts seconds-based timings returned by the existing getSceneTimings()
 * into strict integer frame counts for Remotion.
 *
 * Rounding strategy: we round each cumulative boundary (start/end) to the
 * nearest frame independently, then derive duration from the rounded
 * boundaries. This avoids compounding rounding error across many scenes
 * (rounding each duration separately would drift the total runtime).
 *
 * @param {Array} voiceoverSegments
 * @param {Object} voiceConfig
 * @param {number} fps
 * @returns {Array<{id:string,text:string,type:string,startSeconds:number,endSeconds:number,startFrame:number,endFrame:number,durationInFrames:number}>}
 */
export async function computeSceneFrameTimings(voiceoverSegments, voiceConfig, fps = FPS) {
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error(`FPS must be a positive integer, got: ${fps}`);
  }

  const rawTimings = await getSceneTimings(voiceoverSegments, voiceConfig);

  if (!Array.isArray(rawTimings) || rawTimings.length === 0) {
    throw new Error("getSceneTimings() returned no scene timings.");
  }

  let previousEndFrame = 0;

  return rawTimings.map((timing, index) => {
    const { id, start, end, text, type, ...rest } = timing;

    if (typeof start !== "number" || typeof end !== "number" || end <= start) {
      throw new Error(
        `Scene ${index} (${id ?? "unknown"}) has an invalid time range: start=${start}, end=${end}`
      );
    }

    // Round to the nearest integer frame. Strictly integer per spec.
    const startFrame = Math.max(previousEndFrame, Math.round(start * fps));
    let endFrame = Math.round(end * fps);

    if (endFrame <= startFrame) {
      // Guarantee every scene gets at least 1 frame of screen time even if
      // rounding collapsed a very short segment.
      endFrame = startFrame + 1;
    }

    const durationInFrames = endFrame - startFrame;
    previousEndFrame = endFrame;

    return {
      id: id ?? `scene-${index}`,
      sceneIndex: index,
      text: text ?? "",
      type: type ?? null,
      startSeconds: start,
      endSeconds: end,
      startFrame,
      endFrame,
      durationInFrames,
      fps,
      ...rest, // preserve media, keywords, embedding, styleOverrides, etc.
    };
  });
}

/** Total composition length in frames, derived from the last scene's endFrame. */
export function getTotalDurationInFrames(sceneFrameTimings) {
  return sceneFrameTimings.reduce((max, s) => Math.max(max, s.endFrame), 0);
}
