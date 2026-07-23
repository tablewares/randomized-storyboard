import seedrandom from "seedrandom";
import { MASTER_SEED } from "../config.js";

/**
 * Creates a deterministic PRNG scoped to a single scene.
 *
 * Per spec: seedrandom(masterSeed + "_" + sceneIndex). This MUST be the only
 * source of randomness used anywhere in pipeline 2 -- never Math.random().
 *
 * @param {number} sceneIndex
 * @param {string} masterSeed defaults to config.MASTER_SEED
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function createSceneRng(sceneIndex, masterSeed = MASTER_SEED) {
  const seed = `${masterSeed}_${sceneIndex}`;
  return seedrandom(seed);
}

/** rng() float in [min, max) */
export function rngRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** rng() integer in [min, max] inclusive */
export function rngInt(rng, min, max) {
  return Math.floor(rngRange(rng, min, max + 1));
}

/** Deterministically pick one element from an array using rng. */
export function rngPick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[rngInt(rng, 0, arr.length - 1)];
}
