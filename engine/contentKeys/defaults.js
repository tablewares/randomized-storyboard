import { CONTENT_KEY_REGISTRY } from "./registry.js";

/**
 * Builds a content object that hydrates every key a template declares support
 * for, using derivation rules from CONTENT_KEY_REGISTRY.type. The result is a
 * minimal but well-shaped preview payload: each key gets a placeholdervalue
 * short enough to pass validateAndTruncateContent and long enough to actually
 * exercise the structure component's layout. No manifest carries a `default`
 * field, so this is the single canonical source of preview defaults.
 *
 * Rules:
 *   - string / richText -> "<Key>"  (e.g. "quote", "title"); under any maxChars.
 *   - number             -> 1
 *   - array              -> ["<Key> 1", "<Key> 2", "<Key> 3"] clamped to
 *                            support.maxItems ?? def.defaultMaxItems ?? 3
 *   - image              -> { url: "", alt: "<Key>" }  (empty url: components
 *                            typically render nothing or a swatch; acceptable
 *                            for preview v1)
 *
 * Required and optional keys are both hydrated — previewing optional fields
 * exercises more of the template than strictly required would. Per-manifest
 * `maxChars` / `maxItems` are honoured so truncate is a no-op on the result.
 *
 * @param {Object} supported - template.supportedContentKeys (manifest)
 * @returns {{ content: Object }}
 */
export function hydrateDefaultContent(supported) {
  const content = {};
  for (const [key, support] of Object.entries(supported ?? {})) {
    const def = CONTENT_KEY_REGISTRY[key];
    if (!def) continue;
    content[key] = defaultValueFor(key, def, support);
  }
  return { content };
}

/** @returns {string|number|Array|{url:string,alt:string}} */
function defaultValueFor(key, def, support) {
  switch (def.type) {
    case "string":
    case "richText": {
      const maxChars = support.maxChars ?? def.defaultMaxChars;
      const placeholder = String(key);
      if (maxChars && placeholder.length > maxChars) {
        return placeholder.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "\u2026";
      }
      return placeholder;
    }
    case "number":
      return 1;
    case "array": {
      const cap = support.maxItems ?? def.defaultMaxItems ?? 3;
      const n = Math.max(1, Math.min(cap, 3));
      // `images` is an array OF image objects, not strings — produce the same
      // shape as the singular `image` default per entry so gallery/comparison
      // templates don't <img src="images 1"> and abort renderStill/renderMedia.
      if (key === "images") {
        const base = hydrateDefaultContent({ image: {} }).content.image;
        return Array.from({ length: n }, () => ({ ...base, alt: "images" }));
      }
      return Array.from({ length: n }, (_, i) => `${key} ${i + 1}`);
    }
    case "image":
      // 1x1 transparent PNG data URL so structure components that <img> the
      // value render a blank swatch instead of throwing a load error that
      // aborts renderStill/renderMedia. Keep the alt text for accessibility.
      return { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC", alt: String(key) };
    default:
      return null;
  }
}
