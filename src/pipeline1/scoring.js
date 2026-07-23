import path from "node:path";
import {
  loadTemplateManifests,
  appendJsonLog,
} from "../utils/fsHelpers.js";
import { normalizedCosine } from "../utils/cosineSimilarity.js";
import {
  THRESHOLD,
  SCORING_WEIGHTS,
  FALLBACK_TEMPLATE_KEY,
} from "../config.js";
import {
  PRIMARY_TEMPLATE_ROOT,
  SECONDARY_TEMPLATE_ROOT,
  UNMATCHED_LOG_PATH,
} from "../paths.js";

/**
 * Scores a single scene against a single template using three signals:
 *   a) exact key match       (scene.type === manifest.key)
 *   b) character capacity    (scene text length fits manifest.capacity range)
 *   c) cosine similarity     (scene.embedding vs manifest.embedding)
 *
 * Returns a composite score in [0, 1].
 */
export function scoreSceneAgainstTemplate(scene, template) {
  const manifest = template.manifest;

  // (a) Exact key matching
  const exactKeyScore =
    scene.type && manifest.key && scene.type === manifest.key ? 1 : 0;

  // (b) Character count capacity
  const charCount = (scene.text || "").length;
  const capacity = manifest.capacity || {};
  const min = typeof capacity.minChars === "number" ? capacity.minChars : 0;
  const max = typeof capacity.maxChars === "number" ? capacity.maxChars : Infinity;
  let charCapacityScore;
  if (charCount >= min && charCount <= max) {
    charCapacityScore = 1;
  } else {
    // Soft falloff proportional to how far outside the capacity band we are,
    // relative to the band width (or an assumed 100-char band if unbounded).
    const band = Number.isFinite(max) ? Math.max(max - min, 1) : 100;
    const distance = charCount < min ? min - charCount : charCount - max;
    charCapacityScore = Math.max(0, 1 - distance / band);
  }

  // (c) Cosine similarity between scene embedding and template embedding
  const cosineScore =
    Array.isArray(scene.embedding) && Array.isArray(manifest.embedding)
      ? normalizedCosine(scene.embedding, manifest.embedding)
      : 0;

  const composite =
    exactKeyScore * SCORING_WEIGHTS.exactKey +
    charCapacityScore * SCORING_WEIGHTS.charCapacity +
    cosineScore * SCORING_WEIGHTS.cosineSimilarity;

  return {
    composite,
    breakdown: { exactKeyScore, charCapacityScore, cosineScore },
  };
}

/** Scores a scene against every template in a list, returns best match + score. */
function findBestMatch(scene, templates) {
  let best = null;

  for (const template of templates) {
    const { composite, breakdown } = scoreSceneAgainstTemplate(scene, template);
    if (!best || composite > best.composite) {
      best = { template, composite, breakdown };
    }
  }

  return best;
}

/**
 * Resolves a template for every scene:
 *   1. Score against primary template root.
 *   2. If best score < THRESHOLD, score against secondary template root.
 *   3. If still below THRESHOLD, log to unmatched_scenes.json and fall back
 *      to the primitive fallback template.
 *
 * @param {Array} scenesWithTiming  Output of computeSceneFrameTimings(), each
 *                                  scene may optionally carry an `embedding`.
 * @returns {Array} scenes annotated with `matchedTemplate` and `matchScore`.
 */
export function matchScenesToTemplates(scenesWithTiming) {
  const primaryTemplates = loadTemplateManifests(PRIMARY_TEMPLATE_ROOT);
  const secondaryTemplates = loadTemplateManifests(SECONDARY_TEMPLATE_ROOT);

  const fallbackTemplate = primaryTemplates.find(
    (t) => t.key === FALLBACK_TEMPLATE_KEY
  );
  if (!fallbackTemplate) {
    throw new Error(
      `Fallback template "${FALLBACK_TEMPLATE_KEY}" not found under ${PRIMARY_TEMPLATE_ROOT}. ` +
        "A primitive fallback template is required."
    );
  }

  const unmatchedRecords = [];
  console.log("scenewithtiming", scenesWithTiming)
  const resolvedScenes = scenesWithTiming.map((scene) => {
    const primaryBest = findBestMatch(scene, primaryTemplates);

    if (primaryBest && primaryBest.composite >= THRESHOLD) {
      return annotate(scene, primaryBest, "primary");
    }

    const secondaryBest = findBestMatch(scene, secondaryTemplates);

    if (secondaryBest && secondaryBest.composite >= THRESHOLD) {
      return annotate(scene, secondaryBest, "secondary");
    }

    // No acceptable match anywhere -> log + fallback.
    unmatchedRecords.push({
      sceneId: scene.id,
      sceneIndex: scene.sceneIndex,
      text: scene.text,
      bestPrimaryScore: primaryBest?.composite ?? null,
      bestPrimaryKey: primaryBest?.template.key ?? null,
      bestSecondaryScore: secondaryBest?.composite ?? null,
      bestSecondaryKey: secondaryBest?.template.key ?? null,
      threshold: THRESHOLD,
      timestamp: new Date().toISOString(),
    });

    return annotate(
      scene,
      { template: fallbackTemplate, composite: 0, breakdown: null },
      "fallback"
    );
  });

  if (unmatchedRecords.length > 0) {
    appendJsonLog(UNMATCHED_LOG_PATH, unmatchedRecords);
    console.warn(
      `[scoring] ${unmatchedRecords.length} scene(s) unmatched, logged to ${path.basename(
        UNMATCHED_LOG_PATH
      )} and assigned fallback template.`
    );
  }

  return resolvedScenes;
}

function annotate(scene, best, matchSource) {
  return {
    ...scene,
    matchedTemplate: best.template,
    matchScore: best.composite,
    matchBreakdown: best.breakdown,
    matchSource, // "primary" | "secondary" | "fallback"
  };
}
