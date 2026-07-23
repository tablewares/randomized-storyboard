/**
 * Standard cosine similarity between two equal-length numeric vectors.
 * Returns a value in [-1, 1]; the scoring engine clamps/normalizes it to [0, 1].
 */
export function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0) {
    return 0;
  }
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Embedding dimension mismatch: scene=${vecA.length} template=${vecB.length}`
    );
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  if (magA === 0 || magB === 0) return 0;

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/** Maps cosine similarity from [-1, 1] to a normalized [0, 1] score. */
export function normalizedCosine(vecA, vecB) {
  const sim = cosineSimilarity(vecA, vecB);
  return (sim + 1) / 2;
}
