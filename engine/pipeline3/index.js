import { listSfxFiles, selectSfxForScenes } from "./sfxSelection.js";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
export async function preparePipeline3(storyboard, pipeline1, pipeline2, cfg) {
  const fps = storyboard.fps ?? 30;
  const scenes = pipeline2.hydratedScenes;

  const totalDurationSec = Math.max(...pipeline1.sceneTimings.map((t) => t.endSec));

  const sfxFiles = cfg.sfxDir ? await listSfxFiles(cfg) : [];
  const sfx = selectSfxForScenes(storyboard.seed, scenes, sfxFiles);

  const transitions = pipeline1.templateSelections.slice(1).map((sel, i) => ({
    betweenSceneId: pipeline1.templateSelections[i].sceneId,
    andSceneId: sel.sceneId,
    type: sel.transitionIn,
  }));

  // Copy audio file to public folder for Remotion to serve
  const publicDir = path.join(__dirname, "../../public");
  await mkdir(publicDir, { recursive: true });
  
  let audioPath = pipeline1.audioPath;
  if (audioPath.startsWith("/home/") || audioPath.startsWith("/mnt/") || audioPath.startsWith("/Users/") || audioPath.startsWith("/root/")) {
    const audioFilename = path.basename(audioPath);
    const destPath = path.join(publicDir, audioFilename);
    await copyFile(audioPath, destPath);
    audioPath = audioFilename;
  }

  // Copy music file to public folder if it exists
  let musicPath = cfg.music;
  if (musicPath && (musicPath.startsWith("/home/") || musicPath.startsWith("/mnt/") || musicPath.startsWith("/Users/") || musicPath.startsWith("/root/"))) {
    const musicFilename = path.basename(musicPath);
    const destPath = path.join(publicDir, musicFilename);
    await copyFile(musicPath, destPath);
    musicPath = musicFilename;
  }

  // Copy SFX files to public folder
  const sfxWithPaths = sfx.map((s) => {
    let sfxPath = s.sfxPath;
    if (sfxPath.startsWith("/home/") || sfxPath.startsWith("/mnt/") || sfxPath.startsWith("/Users/") || sfxPath.startsWith("/root/")) {
      const sfxFilename = path.basename(sfxPath);
      const destPath = path.join(publicDir, sfxFilename);
      copyFile(sfxPath, destPath).catch(() => {}); // Best effort, don't fail if missing
      sfxPath = sfxFilename;
    }
    return { ...s, sfxPath };
  });

  // No longer need to copy structure files to public - they are now statically imported in StoryboardVideo.jsx
  // Just use the filename for the lookup map in StoryboardVideo.jsx
  const scenesWithStructureFilenames = scenes.map((scene) => ({
    ...scene,
    structurePath: path.basename(scene.structurePath),
  }));

  const renderInput = {
    fps,
    totalDurationSec,
    audioPath,
    music: cfg.music ? { path: musicPath, volume: 0.25 } : null,
    sfx: sfxWithPaths,
    scenes: scenesWithStructureFilenames,
    transitions,
  };

  return { renderInput };
}
