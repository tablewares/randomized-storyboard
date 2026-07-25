import { deriveRng, pick } from "../random/seededRandom.js";
import { DEFAULT_SCORING_WEIGHTS, rankTemplatesForScene } from "../scoring/templateScoring.js";
import { synthesizeAndAlign } from "./voiceover.js";

/** General transition pool. Extend as needed; kept content-agnostic on purpose. */
export const DEFAULT_TRANSITIONS = ["cut", "fade", "slide-left", "slide-up", "wipe", "zoom-blend"];

/**
 * @typedef {Object} Pipeline1Config
 * @property {import("../../types.js").TemplateRegistry} templateRegistry
 * @property {import("./voiceover.js").TtsAlignFn} ttsAlignFn
 * @property {import("../scoring/templateScoring.js").ScoringWeights} [scoringWeights]
 * @property {import("../scoring/embeddings.js").EmbeddingProvider} [embedder]
 * @property {number} [selectionThreshold] - score below this is still used (best-effort), but logged as a warning
 * @property {readonly string[]} [transitions]
 */

/**
 * @param {import("../../types.js").Storyboard} storyboard
 * @param {Pipeline1Config} config
 * @returns {Promise<import("../../types.js").Pipeline1Output>}
 */
export async function runPipeline1(storyboard, config) {
  const {
    templateRegistry,
    scoringWeights = DEFAULT_SCORING_WEIGHTS,
    embedder,
    selectionThreshold = 0.5,
    transitions = DEFAULT_TRANSITIONS,
    voicecfg,
  } = config;

  if (storyboard.scenes.length === 0) {
    throw new Error("Storyboard has no scenes.");
  }

  // ---- 1. Voiceover synthesis + rough per-scene timing --------------------
  const segments = storyboard.scenes.map((s) => ({ id: s.id, text: s.voiceover }));
  const { audioPath, sceneTimings } = await synthesizeAndAlign(segments, voicecfg);
  
  // ---- 2. Template selection per scene, via weighted scoring --------------
  const candidates = Array.from(templateRegistry.values());
  const templateSelections = [];
  const warnings = [];

  for (const scene of storyboard.scenes) {
    const ranked = await rankTemplatesForScene(scene, candidates, scoringWeights, embedder);
    if (ranked.length === 0) {
      throw new Error(`No candidate templates available to score scene "${scene.id}" against.`);
    }
    const best = ranked[0];

    if (best.score < selectionThreshold) {
      warnings.push({
        sceneId: scene.id,
        bestTemplateId: best.templateId,
        score: best.score,
        threshold: selectionThreshold,
        reason: buildLowScoreReason(best),
      });
    }

    templateSelections.push({
      sceneId: scene.id,
      templateId: best.templateId,
      family: best.family,
      score: best.score,
      scoreBreakdown: best.breakdown,
      transitionIn: "cut", // filled in below once we know scene order
      transitionOut: "cut",
    });
  }

  // ---- 3. Transitions between consecutive scenes, from the master seed ----
  for (let i = 0; i < templateSelections.length; i++) {
    if (i === 0) continue; // first scene has no "in" transition (starts cold)
    const rng = deriveRng(storyboard.seed, "transition", i);
    const chosen = pick(rng, transitions);
    templateSelections[i].transitionIn = chosen;
    templateSelections[i - 1].transitionOut = chosen; // symmetric: the cut between A and B is one transition
  }

  return { audioPath, sceneTimings, templateSelections, warnings, templateRegistry };
}

function buildLowScoreReason(best) {
  const weakest = Object.entries(best.breakdown).sort((a, b) => a[1] - b[1])[0];
  const weakLabel = weakest ? `${weakest[0]} (${weakest[1].toFixed(2)})` : "unknown";
  return (
    `Best available template "${best.templateId}" only scored ${best.score.toFixed(2)}, ` +
    `below threshold. Weakest dimension: ${weakLabel}. Consider authoring a new template ` +
    `(or a new variation) that better supports this scene's content keys/keywords/length, ` +
    `or adjust the scene's content to fit an existing template.`
  );
}
