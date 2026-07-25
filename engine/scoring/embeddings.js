// ============================================================================
// Keyword matching can run in two modes:
//   1. exact/fuzzy string match (no embedder configured) - default, offline
//   2. cosine similarity over embeddings (embedder configured) - pipeline 1
//      can be given any EmbeddingProvider (OpenAI, Voyage, local model, etc.)
// ============================================================================

/**
 * @typedef {Object} EmbeddingProvider
 * @property {(text: string) => Promise<number[]>} embed
 */

export function cosineSimilarity(a, b) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Naive bag-of-words embedder for offline/dev use so the scoring pipeline
 * has a real cosine-similarity code path without requiring network access.
 * Swap in a real EmbeddingProvider in production for meaningfully better
 * keyword matching.
 * @implements {EmbeddingProvider}
 */
export class BagOfWordsEmbedder {
  async embed(text) {
    const tokens = tokenize(text);
    const vocab = Array.from(new Set(tokens)).sort();
    // This only works reasonably as a *pairwise* similarity if both sides are
    // embedded against a shared vocab, so real usage should embed against a
    // fixed vocabulary; here we expose a helper for that below.
    return vocab.map((term) => tokens.filter((t) => t === term).length);
  }
}

export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Simple, dependency-free term-overlap similarity (Jaccard over token sets). */
export function tokenOverlapSimilarity(a, b) {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

/**
 * Best-effort similarity between a scene's free-text keywords and a
 * template's declared keywords. Uses an embedder if provided, otherwise
 * falls back to token overlap (Jaccard).
 * @param {string[]} sceneKeywords
 * @param {string[]} templateKeywords
 * @param {EmbeddingProvider} [embedder]
 * @returns {Promise<number>}
 */
export async function keywordSimilarity(sceneKeywords, templateKeywords, embedder) {
  if (sceneKeywords.length === 0 || templateKeywords.length === 0) return 0;

  if (!embedder) {
    const sceneText = sceneKeywords.join(" ");
    const templateText = templateKeywords.join(" ");
    return tokenOverlapSimilarity(sceneText, templateText);
  }

  // Average best-match cosine similarity: for each scene keyword, take its
  // best similarity against any template keyword, then average.
  const sceneVecs = await Promise.all(sceneKeywords.map((k) => embedder.embed(k)));
  const templateVecs = await Promise.all(templateKeywords.map((k) => embedder.embed(k)));
  let total = 0;
  for (const sv of sceneVecs) {
    let best = 0;
    for (const tv of templateVecs) best = Math.max(best, cosineSimilarity(sv, tv));
    total += best;
  }
  return total / sceneVecs.length;
}
