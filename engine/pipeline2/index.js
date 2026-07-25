import path from "node:path";
import { deriveRng, pickWeighted } from "../random/seededRandom.js";
import { validateAndTruncateContent } from "../contentKeys/registry.js";
import { mergeStyles } from "./styleMerge.js";

/**
 * @typedef {Object} Pipeline2Config
 * @property {import("../../types.js").TemplateRegistry} templateRegistry
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
 * @returns {import("../../types.js").Pipeline2Output}
 */
export function runPipeline2(storyboard, pipeline1, config) {
  const { templateRegistry } = config;
  const timingBySceneId = new Map(pipeline1.sceneTimings.map((t) => [t.sceneId, t]));
  const selectionBySceneId = new Map(pipeline1.templateSelections.map((s) => [s.sceneId, s]));

  const hydratedScenes = storyboard.scenes.map((scene) => {
    const selection = selectionBySceneId.get(scene.id);
    if (!selection) throw new Error(`Pipeline 1 produced no template selection for scene "${scene.id}".`);

    const template = templateRegistry.get(selection.templateId);
    if (!template) throw new Error(`Template "${selection.templateId}" not found in registry during pipeline 2.`);

    const timing = timingBySceneId.get(scene.id);
    if (!timing) throw new Error(`Pipeline 1 produced no timing for scene "${scene.id}".`);

    // Seeded, reproducible variation choice, independent per scene.
    const rng = deriveRng(storyboard.seed, "variation", scene.id, template.templateId);
    const variation = pickWeighted(rng, template.variations);

    const { content, warnings: contentWarnings } = validateAndTruncateContent(
      scene.content,
      template.supportedContentKeys
    );

    const style = mergeStyles(variation.style, storyboard.globalStyle, scene.styleOverrides);

    return {
      sceneId: scene.id,
      family: template.family,
      templateId: template.templateId,
      variationId: variation.id,
      structurePath: path.join(template.dir, variation.structure),
      animation: variation.animation,
      content,
      style,
      timing,
      contentWarnings,
    };
  });

  return { hydratedScenes };
}
