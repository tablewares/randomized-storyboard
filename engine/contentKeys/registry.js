/**
 * THE single source of truth for what content keys exist in this system.
 * Agents generating storyboards, and template authors writing manifests,
 * should only ever reference keys from here. Add new keys here first, then
 * templates can opt in via `supportedContentKeys` in their manifest.
 *
 * @type {Object.<import("../../types.js").StandardContentKey, {
 *   key: string,
 *   type: "string"|"richText"|"number"|"array"|"image",
 *   description: string,
 *   defaultMaxChars?: number,
 *   defaultMaxItems?: number,
 * }>}
 */
export const CONTENT_KEY_REGISTRY = {
  title: { key: "title", type: "string", description: "Primary headline text.", defaultMaxChars: 60 },
  subtitle: { key: "subtitle", type: "string", description: "Secondary headline text.", defaultMaxChars: 80 },
  description: { key: "description", type: "richText", description: "Body/paragraph copy.", defaultMaxChars: 240 },
  author: { key: "author", type: "string", description: "Attribution name.", defaultMaxChars: 40 },
  number: { key: "number", type: "number", description: "A standalone stat/figure (e.g. rank, percentage)." },
  label: { key: "label", type: "string", description: "Short tag/badge text.", defaultMaxChars: 20 },
  value: { key: "value", type: "string", description: "Short value paired with a label.", defaultMaxChars: 20 },
  quote: { key: "quote", type: "richText", description: "Quoted text for quote-style templates.", defaultMaxChars: 220 },
  source: { key: "source", type: "string", description: "Citation/source for a quote or stat.", defaultMaxChars: 50 },
  caption: { key: "caption", type: "string", description: "Short text describing an image/video.", defaultMaxChars: 100 },
  date: { key: "date", type: "string", description: "A date or date range string.", defaultMaxChars: 30 },
  items: { key: "items", type: "array", description: "List entries for list-style templates.", defaultMaxItems: 8 },
  tags: { key: "tags", type: "array", description: "Short keyword chips.", defaultMaxItems: 6 },
  image: { key: "image", type: "image", description: "A single image (url/path + optional alt)." },
  images: { key: "images", type: "array", description: "Multiple images, e.g. for comparisons.", defaultMaxItems: 4 },
  icon: { key: "icon", type: "image", description: "A small iconographic image." },
  video: { key: "video", type: "image", description: "A video source (url/path)." },
};

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isKnownContentKey(key) {
  return Object.prototype.hasOwnProperty.call(CONTENT_KEY_REGISTRY, key);
}

export function listContentKeys() {
  return Object.values(CONTENT_KEY_REGISTRY);
}

/** Rough length of a content value, used for char-fit scoring and truncation. */
export function measureLength(value) {
  if (value == null) return 0;
  if (typeof value === "string") return value.length;
  if (typeof value === "number") return String(value).length;
  if (Array.isArray(value)) {
    return value.reduce((sum, v) => sum + (typeof v === "string" ? v.length : String(v).length), 0);
  }
  if (typeof value === "object" && "url" in value) return value.alt?.length ?? 0;
  return 0;
}

/**
 * Validates & truncates a scene's content against what a chosen template
 * declares support for. Unsupported keys are dropped (with a warning) so a
 * structure component never receives props it doesn't understand. String
 * values longer than the effective maxChars are truncated.
 *
 * @param {Object} content
 * @param {Object} supported - template.supportedContentKeys
 * @returns {{content: Object, warnings: string[]}}
 */
export function validateAndTruncateContent(content, supported) {
  const warnings = [];
  const result = {};

  for (const [key, value] of Object.entries(content)) {
    if (!isKnownContentKey(key)) {
      warnings.push(`Unknown content key "${key}" ignored (not in CONTENT_KEY_REGISTRY).`);
      continue;
    }
    const support = supported[key];
    if (!support) {
      warnings.push(`Content key "${key}" dropped: template does not declare support for it.`);
      continue;
    }
    const def = CONTENT_KEY_REGISTRY[key];
    result[key] = truncateValue(value, def, support, warnings, key);
  }

  for (const [key, support] of Object.entries(supported ?? {})) {
    if (support.required && (result[key] === undefined || result[key] === "")) {
      warnings.push(`Required content key "${key}" missing or empty for this template.`);
    }
  }

  return { content: result, warnings };
}

function truncateValue(value, def, support, warnings, key) {
  if (value == null) return value;

  if (def.type === "array" && Array.isArray(value)) {
    const maxItems = support.maxItems ?? def.defaultMaxItems ?? value.length;
    if (value.length > maxItems) {
      warnings.push(`"${key}" had ${value.length} items, truncated to ${maxItems}.`);
      return value.slice(0, maxItems);
    }
    return value;
  }

  if ((def.type === "string" || def.type === "richText") && typeof value === "string") {
    const maxChars = support.maxChars ?? def.defaultMaxChars;
    if (maxChars && value.length > maxChars) {
      warnings.push(`"${key}" had ${value.length} chars, truncated to ${maxChars}.`);
      return value.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "\u2026";
    }
    return value;
  }

  return value;
}
