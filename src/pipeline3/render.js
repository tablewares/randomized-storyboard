import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../config.js";
import { runPipelinesOneAndTwo } from "../index.js";
import { loadStoryboard } from "../pipeline1/storyboard.js";

// Optional: point at a pre-installed Chrome/Chromium headless-shell binary
// instead of letting Remotion download its own (useful in sandboxed/offline
// environments where the download host isn't reachable).
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;

/**
 * Full pipeline-3 execution: bundle the Remotion entry point, resolve the
 * "MainVideo" composition against our hydrated input props (so
 * calculateMetadata can compute the exact duration), then render it out.
 *
 * @param {{ voiceoverSegments: Array, voiceConfig: Object, outputPath?: string, fps?: number, width?: number, height?: number }} args
 */
export async function renderVideo({
  voiceoverSegments,
  voiceConfig,
  outputPath,
  fps = FPS,
  width = VIDEO_WIDTH,
  height = VIDEO_HEIGHT,
}) {
  // Pipelines 1 + 2: timing, scoring, and hydration.
  const { hydratedScenes, totalDurationInFrames } = runPipelinesOneAndTwo(
    voiceoverSegments,
    voiceConfig,
    fps
  );

  const inputProps = {
    hydratedScenes,
    totalDurationInFrames,
    fps,
    width,
    height,
  };

  // Bundle the Remotion entry point (webpack build of src/pipeline3/index.jsx).
  const entryPoint = path.join(process.cwd(), "src/pipeline3/index.jsx");
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
    // Template assets live under templates/*/assets rather than a
    // conventional public/ folder, so we serve the whole project root as
    // the public dir -- pipeline2 resolves local asset URLs relative to it
    // (see resolveAssetUrl in pipeline2/templating.js) and templates call
    // staticFile() on them.
    publicDir: process.cwd(),
  });

  // Resolve composition metadata (duration/fps/dimensions) using our props,
  // so calculateMetadata in index.js can compute the real duration.
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "MainVideo",
    inputProps,
    browserExecutable,
  });

  const finalOutputPath =
    outputPath || path.join(process.cwd(), "out", "MainVideo.mp4");

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation: finalOutputPath,
    inputProps,
    browserExecutable,
    // Remote/local media inside templates use <Img /> / <OffthreadVideo />,
    // which are timeout-safe for renderMedia by design (per pipeline 3 spec).
    timeoutInMilliseconds: 120000,
  });

  return finalOutputPath;
}

/**
 * New entrypoint: renders a video straight from a storyboard JSON file on
 * disk, instead of requiring callers to hand-build the
 * `{ voiceoverSegments, voiceConfig }` object in code.
 *
 * Authoring guide + schema: skills/storyboard-json/SKILL.md
 * (skills/storyboard-json/references/schema.md for the full field reference).
 *
 * @param {string} storyboardFilePath  Path to a *.storyboard.json file.
 * @param {{ outputPath?: string }} [overrides]  Optional overrides, e.g. a
 *        CLI-supplied output path that should win over the one in the file.
 * @returns {Promise<string>} path to the rendered mp4
 */
export async function renderVideoFromStoryboardFile(storyboardFilePath, overrides = {}, vc) {
  const storyboard = loadStoryboard(storyboardFilePath);

  return renderVideo({
    voiceoverSegments: storyboard.voiceoverSegments,
    voiceConfig: vc ,
    outputPath: overrides.outputPath || storyboard.outputPath,
    fps: storyboard.fps,
    width: storyboard.width,
    height: storyboard.height,
  });
}

// Allow running as a script:
//   node src/pipeline3/render.js path/to/scene.storyboard.json [outputPath]
// Falls back to a small hard-coded example if no storyboard path is given.
  const [, , storyboardArg, outputArg] = process.argv;
  const vc = { workDir: '.', voiceId: "george", speed: 1, alignment: {
          model: "small",
        language:  "en",
        device:  "cpu",
        computeType: "int8",
    } };
  const renderPromise = storyboardArg
    ? renderVideoFromStoryboardFile(storyboardArg, { outputPath: outputArg }, vc)
    : renderVideo({
        voiceoverSegments: [
          { id: "s0", type: "quote", text: "The best way to predict the future is to invent it." },
          { id: "s1", type: "image-panel", text: "A quiet morning by the lake." },
        ],
        voiceConfig: {}
      });
  

  renderPromise
    .then((outPath) => console.log(`Rendered video to: ${outPath}`))
    .catch((err) => {
      console.error("Render failed:", err);
      process.exit(1);
    });
