import { listSfxFiles, selectSfxForScenes } from "./sfxSelection.js";

/**
 * @typedef {Object} Pipeline3PrepResult
 * @property {import("../../types.js").RenderInput} renderInput
 */

/**
 * Assembles the final RenderInput handed to the Remotion composition
 * (RemotionRoot.jsx). This stage does not itself talk to Remotion's
 * bundler/renderer - see `render.js` for the actual render invocation,
 * which is deliberately kept separate so the pure data-assembly logic here
 * stays easy to unit test.
 *
 * @param {import("../../types.js").Storyboard} storyboard
 * @param {import("../../types.js").Pipeline1Output} pipeline1
 * @param {import("../../types.js").Pipeline2Output} pipeline2
 * @returns {Promise<Pipeline3PrepResult>}
 */
export async function preparePipeline3(storyboard, pipeline1, pipeline2) {
  const fps = storyboard.fps ?? 30;
  const scenes = pipeline2.hydratedScenes;

  const totalDurationSec = Math.max(...pipeline1.sceneTimings.map((t) => t.endSec));

  const sfxFiles = storyboard.sfxDir ? await listSfxFiles(storyboard.sfxDir) : [];
  const sfx = selectSfxForScenes(storyboard.seed, scenes, sfxFiles);

  const transitions = pipeline1.templateSelections.slice(1).map((sel, i) => ({
    betweenSceneId: pipeline1.templateSelections[i].sceneId,
    andSceneId: sel.sceneId,
    type: sel.transitionIn,
  }));

  const renderInput = {
    fps,
    totalDurationSec,
    audioPath: pipeline1.audioPath,
    music: storyboard.music,
    sfx,
    scenes,
    transitions,
  };

  return { renderInput };
}
