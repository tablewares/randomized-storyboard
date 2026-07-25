import { CONTENT_KEY_REGISTRY, isKnownContentKey, measureLength } from "../contentKeys/registry.js";
import { keywordSimilarity } from "./embeddings.js";

/**
 * @typedef {Object} ScoringWeights
 * @property {number} keyCoverage
 * @property {number} charFit
 * @property {number} keyword
 * @property {number} familyHint
 */

/** @type {ScoringWeights} */
export const DEFAULT_SCORING_WEIGHTS = {
  keyCoverage: 0.4,
  charFit: 0.25,
  keyword: 0.25,
  familyHint: 0.1,
};

/**
 * @typedef {Object} ScoredTemplate
 * @property {string} templateId
 * @property {string} family
 * @property {number} score
 * @property {Object.<string, number>} breakdown
 */

/**
 * Scores one scene against one template manifest. All sub-scores are in
 * [0, 1]; the final score is a weighted sum, also in [0, 1] (weights should
 * sum to 1, but are not required to).
 *
 * @param {import("../../types.js").StoryboardScene} scene
 * @param {import("../../types.js").ResolvedTemplate} template
 * @param {ScoringWeights} [weights]
 * @param {import("./embeddings.js").EmbeddingProvider} [embedder]
 * @returns {Promise<ScoredTemplate>}
 */
export async function scoreSceneAgainstTemplate(scene, template, weights = DEFAULT_SCORING_WEIGHTS, embedder) {
  const keyCoverage = scoreKeyCoverage(scene.content, template);
  const charFit = scoreCharFit(scene.content, template);
  const keyword = await keywordSimilarity(scene.keywords ?? [], template.keywords ?? [], embedder);
  const familyHint = scene.family && scene.family === template.family ? 1 : scene.family ? 0 : 0.5; // neutral if scene doesn't specify

  const breakdown = { keyCoverage, charFit, keyword, familyHint };

  const score =
    keyCoverage * weights.keyCoverage +
    charFit * weights.charFit +
    keyword * weights.keyword +
    familyHint * weights.familyHint;

  return { templateId: template.templateId, family: template.family, score, breakdown };
}

/**
 * Two-directional coverage:
 *  - how much of what the SCENE provides is actually usable by the template
 *  - how much of what the template REQUIRES is actually present in the scene
 * Both matter: a template that supports far more than the scene needs isn't
 * penalized (extra optional keys are fine), but a template missing keys the
 * scene relies on, or a scene missing keys the template requires, hurts.
 */
function scoreKeyCoverage(content, template) {
  const sceneKeys = Object.keys(content).filter(isKnownContentKey);
  const supported = template.supportedContentKeys;

  const usableByTemplate = sceneKeys.filter((k) => supported[k]);
  const providedScore = sceneKeys.length === 0 ? 1 : usableByTemplate.length / sceneKeys.length;

  const requiredKeys = Object.entries(supported)
    .filter(([, v]) => v?.required)
    .map(([k]) => k);
  const requiredPresent = requiredKeys.filter((k) => content[k] != null);
  const requiredScore = requiredKeys.length === 0 ? 1 : requiredPresent.length / requiredKeys.length;

  return providedScore * 0.6 + requiredScore * 0.4;
}

/**
 * For every content key the scene provides AND the template supports,
 * compare the value's length against the template's declared maxChars (or
 * the registry default). 1.0 if it fits, decaying toward 0 the further over
 * the limit it goes.
 */
function scoreCharFit(content, template) {
  const relevantKeys = Object.keys(content).filter((k) => isKnownContentKey(k) && template.supportedContentKeys[k]);
  if (relevantKeys.length === 0) return 1; // nothing to check, don't penalize

  let total = 0;
  for (const key of relevantKeys) {
    const value = content[key];
    const support = template.supportedContentKeys[key];
    const def = CONTENT_KEY_REGISTRY[key];
    const limit = support?.maxChars ?? def?.defaultMaxChars;
    if (!limit) {
      total += 1;
      continue;
    }
    const length = measureLength(value);
    if (length <= limit) {
      total += 1;
    } else {
      const overBy = (length - limit) / limit; // fraction over the limit
      total += Math.max(0, 1 - overBy); // linear decay, floors at 0
    }
  }
  return total / relevantKeys.length;
}

/**
 * Scores every scene against every candidate template (optionally narrowed
 * to a family hint, or a pinned templateId) and returns the ranked list,
 * best first.
 *
 * @param {import("../../types.js").StoryboardScene} scene
 * @param {import("../../types.js").ResolvedTemplate[]} candidates
 * @param {ScoringWeights} [weights]
 * @param {import("./embeddings.js").EmbeddingProvider} [embedder]
 * @returns {Promise<ScoredTemplate[]>}
 */
export async function rankTemplatesForScene(scene, candidates, weights = DEFAULT_SCORING_WEIGHTS, embedder) {
  let pool = candidates;
  if (scene.templateId) {
    pool = candidates.filter((t) => t.templateId === scene.templateId);
  } else if (scene.family) {
    const scoped = candidates.filter((t) => t.family === scene.family);
    if (scoped.length > 0) pool = scoped; // fall back to full pool if family has no templates
  }

  const scored = await Promise.all(pool.map((t) => scoreSceneAgainstTemplate(scene, t, weights, embedder)));
  return scored.sort((a, b) => b.score - a.score);
}
