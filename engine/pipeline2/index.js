import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveRng, pickWeighted } from "../random/seededRandom.js";
import { validateAndTruncateContent } from "../contentKeys/registry.js";
import { mergeStyles } from "./styleMerge.js";
import { resolveMediaContent } from "./resolveMedia.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} Pipeline2Config
 * @property {import("../../types.js").TemplateRegistry} templateRegistry
 * @property {string} [publicDir] - absolute path to the Remotion public/
 *        folder, used by resolveMediaContent to stage local image/video files
 *        for staticFile() at render time. Defaults to "<repoRoot>/public".
 */

/**
 * Consumes pipeline 1's resolved template-per-scene decisions and:
 *   1. deterministically picks a *variation* within each template, seeded
 *      off the master seed so re-runs are stable,
 *   2. validates/truncates scene content against the template's declared
 *      supportedContentKeys,
 *   3. merges style layers (template default -> global -> scene override),
 *   4. attaches per-scene timing from pipeline 1.
 *
 * @param {import("../../types.js").Storyboard} storyboard
 * @param {import("../../types.js").Pipeline1Output} pipeline1
 * @param {Pipeline2Config} config
 * @returns {Promise<import("../../types.js").Pipeline2Output>}
 */
export async function runPipeline2(storyboard, pipeline1, config) {
  const { templateRegistry, publicDir } = config;
  // Default public/ folder to the repo-root public/ directory that pipeline 3
  // also writes into — keeps media staging co-located with audio/sfx when the
  // orchestrator doesn't pass an explicit publicDir override.
  const resolvedPublicDir = publicDir ?? path.join(__dirname, "../../public");
  const timingBySceneId = new Map(pipeline1.sceneTimings.map((t) => [t.sceneId, t]));
  const selectionBySceneId = new Map(pipeline1.templateSelections.map((s) => [s.sceneId, s]));

  // Hydrate scenes sequentially (resolveMediaContent touches the filesystem
  // — copying local media into public/media/. Parallelism would race on
  // mkdirs/duplicate basenames; sequential keeps per-scene warnings ordered
  // with scene position, matching how pipeline 1 reports).
  const hydratedScenes = [];
  for (const scene of storyboard.scenes) {
    const selection = selectionBySceneId.get(scene.id);
    if (!selection) throw new Error(`Pipeline 1 produced no template selection for scene "${scene.id}".`);

    const template = templateRegistry.get(selection.templateId);
    if (!template) throw new Error(`Template "${selection.templateId}" not found in registry during pipeline 2.`);

    const timing = timingBySceneId.get(scene.id);
    if (!timing) throw new Error(`Pipeline 1 produced no timing for scene "${scene.id}".`);

    // Seeded, reproducible variation choice, independent per scene.
    const rng = deriveRng(storyboard.seed, "variation", scene.id, template.templateId);
    const variation = pickWeighted(rng, template.variations);

    const { content: validatedContent, warnings: contentWarnings } = validateAndTruncateContent(
      scene.content,
      template.supportedContentKeys
    );

    // Media hydration: walk the *validated* content (so we only resolve
    // media keys the template declared support for) and stage any local
    // image/video files into public/media/ so Remotion's staticFile() can
    // serve them at render. Remote URLs pass through unchanged. Emits
    // per-entry warnings for missing files / failed copies so the orchestrator's
    // pipeline2-output.json carries the same fidelity as content truncation.
    const { content, mediaWarnings } = await resolveMediaContent(validatedContent, {
      publicDir: resolvedPublicDir,
    });

    const style = mergeStyles(variation.style, storyboard.globalStyle, scene.styleOverrides);

    hydratedScenes.push({
      sceneId: scene.id,
      family: template.family,
      templateId: template.templateId,
      variationId: variation.id,
      structurePath: path.join(template.dir, variation.structure),
      animation: variation.animation,
      content,
      style,
      timing,
      contentWarnings: [...contentWarnings, ...mediaWarnings],
    });
  }

  return { hydratedScenes };
}
