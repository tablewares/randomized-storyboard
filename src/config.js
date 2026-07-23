/**
 * Global engine configuration.
 * Centralised so all three pipelines read the same constants.
 */

// Frames-per-second used to convert voiceover timing (seconds) into frame counts.
export const FPS = Number(process.env.VIDEO_FPS) || 30;

// Minimum acceptable score (0..1) for a template match before falling back
// to the secondary template root / primitive fallback.
export const THRESHOLD = Number(process.env.TEMPLATE_MATCH_THRESHOLD) || 0.62;

// Weighting applied to each signal inside the scoring engine. Must sum to 1.
export const SCORING_WEIGHTS = {
  exactKey: 0.35,
  charCapacity: 0.2,
  cosineSimilarity: 0.25,
  keywordMatch: 0.2,
};

// Deterministic seed root. Combined with sceneIndex -> seedrandom(masterSeed + "_" + sceneIndex)
export const MASTER_SEED = process.env.MASTER_SEED || "default-master-seed";

// Fallback template key. Must exist under PRIMARY_TEMPLATE_ROOT.
export const FALLBACK_TEMPLATE_KEY = "_fallback";

// NOTE: filesystem path constants (template roots, unmatched-log path) live
// in ./paths.js, NOT here. This file is imported by the Remotion browser
// bundle entry (pipeline3/index.jsx) for FPS/width/height, and webpack
// statically resolves any `new URL(x, import.meta.url)` it finds as a
// module import -- which breaks when x is a directory. Keeping this file
// free of filesystem URLs keeps it safe to import from browser-side code.

// Output video defaults, used by pipeline 3.
export const VIDEO_WIDTH = Number(process.env.VIDEO_WIDTH) || 1080;
export const VIDEO_HEIGHT = Number(process.env.VIDEO_HEIGHT) || 1920;
