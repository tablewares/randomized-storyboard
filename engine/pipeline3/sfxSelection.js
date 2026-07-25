import { readdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { deriveRng, pick } from "../random/seededRandom.js";

const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a"]);
const PUBLIC_SFX_DIR = path.resolve("public");

/**
 * @param {string} sfxDir
 * @returns {Promise<string[]>}
 */
export async function listSfxFiles(cfg) {
  const sfxDir = path.resolve(cfg.sfxDir);
  console.log("sfxdir", sfxDir);
  let entries;
  try {
    entries = await readdir(sfxDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && AUDIO_EXT.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const src = path.join(sfxDir, e.name);
      const dest = path.join(PUBLIC_SFX_DIR, e.name);
      copyFile(src, dest).catch(() => {});
      return e.name;
    });
}

/**
 * Picks one sfx file per scene, placed at that scene's end timestamp.
 * Each scene gets its own derived RNG stream so adding/removing scenes
 * elsewhere in the storyboard doesn't reshuffle sfx choices for untouched
 * scenes.
 *
 * @param {string|number} masterSeed
 * @param {import("../../types.js").HydratedScene[]} scenes
 * @param {string[]} sfxFiles
 * @returns {import("../../types.js").SfxPlacement[]}
 */
export function selectSfxForScenes(masterSeed, scenes, sfxFiles) {
  if (sfxFiles.length === 0) return [];
  return scenes.map((scene) => {
    const rng = deriveRng(masterSeed, "sfx", scene.sceneId);
    return {
      sceneId: scene.sceneId,
      atSec: scene.timing.endSec,
      sfxPath: pick(rng, sfxFiles),
    };
  });
}
