import { listSfxFiles, selectSfxForScenes } from "./sfxSelection.js";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyStructureFiles, generateStructuresModule } from "./copyStructures.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} Pipeline3PrepResult
 * @property {import("../../types.js").RenderInput} renderInput
 * @property {Map<string, string>} structureMap - structureKey -> unique public path
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
  if (path.isAbsolute(audioPath)) {
    const audioFilename = path.basename(audioPath);
    const destPath = path.join(publicDir, audioFilename);
    await copyFile(audioPath, destPath);
    audioPath = audioFilename;
  }

  // Copy music file to public folder if it exists
  let musicPath = cfg.music;
  if (musicPath && path.isAbsolute(musicPath)) {
    const musicFilename = path.basename(musicPath);
    const destPath = path.join(publicDir, musicFilename);
    await copyFile(musicPath, destPath);
    musicPath = musicFilename;
  }

  // Copy SFX files to public folder
  const sfxWithPaths = sfx.map((s) => {
    let sfxPath = s.sfxPath;
    if (path.isAbsolute(sfxPath)) {
      const sfxFilename = path.basename(sfxPath);
      const destPath = path.join(publicDir, sfxFilename);
      copyFile(sfxPath, destPath).catch(() => {}); // Best effort, don't fail if missing
      sfxPath = sfxFilename;
    }
    return { ...s, sfxPath };
  });

  // Copy structure files from template registry to public/structures with unique names
  // and generate the STRUCTURE_COMPONENTS module for static import
  // Use templateRegistry from pipeline1 (which has the full registry)
  const structureMap = await copyStructureFiles(pipeline1.templateRegistry, publicDir);
  const structuresModulePath = path.join(__dirname, "Structures.jsx");
  await generateStructuresModule(structureMap, structuresModulePath);

  // Use composite key (family-templateId-structureFilename) for lookup in STRUCTURE_COMPONENTS
  // This avoids collisions when multiple templates use the same structure filename
  const scenesWithStructureKeys = scenes.map((scene) => {
    // Find the template to get family and templateId
    const template = pipeline1.templateRegistry.get(scene.templateId);
    if (!template) {
      console.warn(`Template ${scene.templateId} not found in registry, using fallback key`);
      return {
        ...scene,
        structurePath: path.basename(scene.structurePath),
      };
    }
    const safeFamily = template.family.replace(/\//g, "-");
    const safeTemplateId = template.id.replace(/\//g, "-");
    const structureFilename = path.basename(scene.structurePath);
    const structureKey = `${safeFamily}-${safeTemplateId}-${structureFilename}`;
    
    return {
      ...scene,
      structurePath: structureKey,
    };
  });

  const renderInput = {
    fps,
    totalDurationSec,
    audioPath,
    music: cfg.music ? { path: musicPath, volume: 0.25 } : null,
    sfx: sfxWithPaths,
    scenes: scenesWithStructureKeys,
    transitions,
  };

  return { renderInput, structureMap };
}
