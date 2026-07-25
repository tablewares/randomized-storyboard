// ============================================================================
// Deterministic randomization. Every pipeline derives its RNG from the same
// storyboard.seed so a full run is fully reproducible, and so pipeline 2/3
// can be re-run in isolation (e.g. after editing a template) and still agree
// with pipeline 1's choices for anything they didn't change.
// ============================================================================

/** xmur3 string hash -> 32bit seed, used to turn any seed value into a number. */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32: fast, small, decent-quality deterministic PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a reproducible RNG from a master seed (string or number).
 * @param {string|number} seed
 * @returns {() => number} a function returning a float in [0, 1)
 */
export function createRng(seed) {
  const seeded = xmur3(String(seed));
  return mulberry32(seeded());
}

/**
 * Derives a stable sub-seed from the master seed plus arbitrary namespace
 * parts (e.g. sceneId, pipeline stage). This is how each scene / each
 * decision point (transition, variation, sfx) gets its own independent but
 * fully reproducible random stream, without pipelines needing to share
 * mutable RNG state or agree on call order.
 * @param {string|number} masterSeed
 * @param {...(string|number)} parts
 */
export function deriveRng(masterSeed, ...parts) {
  return createRng(`${masterSeed}::${parts.join("::")}`);
}

/**
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T}
 */
export function pick(rng, items) {
  if (items.length === 0) throw new Error("pick() called on empty array");
  const idx = Math.floor(rng() * items.length);
  return items[Math.min(idx, items.length - 1)];
}

/**
 * Weighted random pick; items without an explicit weight default to 1.
 * @template {{weight?: number}} T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T}
 */
export function pickWeighted(rng, items) {
  if (items.length === 0) throw new Error("pickWeighted() called on empty array");
  const weights = items.map((i) => Math.max(0, i.weight ?? 1));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(rng, items);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
