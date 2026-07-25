function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Merge order (later wins): template variation default style
 *   < storyboard.globalStyle (project-wide override)
 *   < scene.styleOverrides (most specific)
 * Nested objects (palette, font, spacing) are merged key-by-key rather than
 * replaced wholesale, so a scene can override just `palette.accent` without
 * losing the template's other palette values.
 *
 * @param {...(import("../../types.js").StandardStyleVars|undefined)} layers
 * @returns {import("../../types.js").StandardStyleVars}
 */
export function mergeStyles(...layers) {
  let result = {};
  for (const layer of layers) {
    if (!layer) continue;
    result = deepMerge(result, layer);
  }
  return result;
}

function deepMerge(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}
