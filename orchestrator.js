import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverTemplates } from "./engine/templates/discovery.js";
import { runPipeline1 } from "./engine/pipeline1/index.js";
import { runPipeline2 } from "./engine/pipeline2/index.js";
import { preparePipeline3 } from "./engine/pipeline3/index.js";
import { renderStoryboardVideo } from "./engine/pipeline3/render.js";

/**
 * @typedef {Object} RunOptions
 * @property {string} templatesRoot
 * @property {import("./types.js").Storyboard} storyboard
 * @property {import("./engine/pipeline1/voiceover.js").TtsAlignFn} ttsAlignFn
 * @property {string} outputDir - where the final mp4 + debug artifacts go
 * @property {import("./engine/scoring/templateScoring.js").ScoringWeights} [scoringWeights]
 * @property {import("./engine/scoring/embeddings.js").EmbeddingProvider} [embedder]
 * @property {number} [selectionThreshold]
 * @property {boolean} [skipRender] - useful for testing pipelines 1-2 without a Remotion/chromium environment
 */

/**
 * @param {RunOptions} opts
 */
export async function runStoryboardEngine(opts) {
  await mkdir(opts.outputDir, { recursive: true });

  // ---- Template discovery (recursive) --------------------------------
  const { registry, families, issues } = await discoverTemplates(opts.templatesRoot);
  if (issues.length > 0) {
    await writeFile(path.join(opts.outputDir, "template-discovery-issues.json"), JSON.stringify(issues, null, 2));
  }
  if (registry.size === 0) {
    throw new Error(`No templates discovered under "${opts.templatesRoot}".`);
  }

  // ---- Pipeline 1: voiceover timing + template + transition selection ----
  const pipeline1 = await runPipeline1(opts.storyboard, {
    templateRegistry: registry,
    scoringWeights: opts.scoringWeights,
    embedder: opts.embedder,
    selectionThreshold: opts.selectionThreshold,
  });
  await writeFile(path.join(opts.outputDir, "pipeline1-output.json"), JSON.stringify(pipeline1, null, 2));
  if (pipeline1.warnings.length > 0) {
    await writeFile(
      path.join(opts.outputDir, "template-selection-warnings.json"),
      JSON.stringify(pipeline1.warnings, null, 2)
    );
  }

  // ---- Pipeline 2: variation selection + content/style hydration --------
  const pipeline2 = runPipeline2(opts.storyboard, pipeline1, { templateRegistry: registry });
  await writeFile(path.join(opts.outputDir, "pipeline2-output.json"), JSON.stringify(pipeline2, null, 2));

  // ---- Pipeline 3: assemble render input, then render with Remotion -----
  const { renderInput } = await preparePipeline3(opts.storyboard, pipeline1, pipeline2);
  await writeFile(path.join(opts.outputDir, "render-input.json"), JSON.stringify(renderInput, null, 2));
  
  let videoPath;
  if (!opts.skipRender) {
    videoPath = await renderStoryboardVideo(renderInput, {
      outputPath: path.join(opts.outputDir, `${opts.storyboard.id}.mp4`),
    });
  }

  return {
    templateFamilies: families,
    pipeline1,
    pipeline2,
    renderInput,
    videoPath,
  };
}
