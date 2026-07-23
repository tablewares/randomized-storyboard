import { computeSceneFrameTimings, getTotalDurationInFrames } from "./pipeline1/timing.js";
import { matchScenesToTemplates } from "./pipeline1/scoring.js";
import { hydrateAllScenes } from "./pipeline2/templating.js";
import { FPS } from "./config.js";

/**
 * Runs pipeline 1 (timing + template scoring) and pipeline 2 (deterministic
 * hydration) end to end. Pipeline 3 (render.js) consumes this output.
 *
 * @param {Array} voiceoverSegments
 * @param {Object} voiceConfig
 * @param {number} fps
 * @returns {{ hydratedScenes: Array, totalDurationInFrames: number }}
 */
export async function runPipelinesOneAndTwo(voiceoverSegments, voiceConfig, fps = FPS) {
  // Wait for scene timings to resolve
  const sceneTimings = await computeSceneFrameTimings(voiceoverSegments, voiceConfig, fps);
  
  // Synchronous transformations
  const matchedScenes = matchScenesToTemplates(sceneTimings);
  const hydratedScenes = hydrateAllScenes(matchedScenes);
  const totalDurationInFrames = getTotalDurationInFrames(sceneTimings);

  return { hydratedScenes, totalDurationInFrames };
}