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
export function runPipelinesOneAndTwo(voiceoverSegments, voiceConfig, fps = FPS) {
  // --- Pipeline 1 ---
  const a = computeSceneFrameTimings(voiceoverSegments, voiceConfig, fps).then((sceneTimings)=> {
    console.log("sceneTimings", sceneTimings)
    const matchedScenes = matchScenesToTemplates(sceneTimings);
      const hydratedScenes = hydrateAllScenes(matchedScenes);

    const totalDurationInFrames = getTotalDurationInFrames(sceneTimings);

    return { hydratedScenes, totalDurationInFrames };
  });
  return a

}

