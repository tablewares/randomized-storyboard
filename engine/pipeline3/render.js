import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} RenderOptions
 * @property {string} outputPath
 * @property {string} [entryPoint] - defaults to RemotionRoot.jsx next to this file
 */

/**
 * Final step of pipeline 3: bundles the Remotion project and renders
 * StoryboardVideo to an mp4 at outputPath, using the assembled RenderInput
 * (which already encodes timing, template selections, style, audio, music,
 * and sfx placements from pipelines 1 and 2).
 *
 * @param {import("../../types.js").RenderInput} renderInput
 * @param {RenderOptions} options
 * @returns {Promise<string>}
 */
export async function renderStoryboardVideo(renderInput, options) {
  const entryPoint = options.entryPoint ?? path.join(__dirname, "RemotionRoot.jsx");

  const bundleLocation = await bundle({ entryPoint });

  const inputProps = { renderInput };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "StoryboardVideo",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: options.outputPath,
    inputProps,
    audioBitrate: "192k",
  });

  return options.outputPath;
}
