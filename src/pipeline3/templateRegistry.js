/**
 * Remotion's bundler (webpack) needs statically analyzable imports to
 * include each template's component in the render bundle. Because the
 * scoring engine can in principle discover new template folders at runtime,
 * every template that should be renderable MUST be registered here as well
 * -- discovery and rendering are deliberately decoupled.
 *
 * Template discovery is recursive: template family folders can contain
 * nested template folders, allowing hierarchical organization.
 * Nested templates get keys prefixed with their folder path (e.g., "anthropic-templates-stat-highlight").
 *
 * AUTO-GENERATED -- DO NOT EDIT MANUALLY.
 */
import _fallbackTemplate from "../../templates/_fallback/index.jsx";
import anthropictemplatesctaoutroTemplate from "../../templates/anthropic-templates/cta-outro/index.jsx";
import anthropictemplatesstathighlightTemplate from "../../templates/anthropic-templates/stat-highlight/index.jsx";
import bulletlistTemplate from "../../templates/bullet-list/index.jsx";
import ctaoutroTemplate from "../../templates/cta-outro/index.jsx";
import imagepanelTemplate from "../../templates/image-panel/index.jsx";
import quoteTemplate from "../../templates/quote/index.jsx";
import stathighlightTemplate from "../../templates/stat-highlight/index.jsx";
import titlecardTemplate from "../../templates/title-card/index.jsx";

export const TEMPLATE_REGISTRY = {
  "_fallback": _fallbackTemplate,
  "anthropic-templates-cta-outro": anthropictemplatesctaoutroTemplate,
  "anthropic-templates-stat-highlight": anthropictemplatesstathighlightTemplate,
  "bullet-list": bulletlistTemplate,
  "cta-outro": ctaoutroTemplate,
  "image-panel": imagepanelTemplate,
  "quote": quoteTemplate,
  "stat-highlight": stathighlightTemplate,
  "title-card": titlecardTemplate,
};

export function resolveTemplateComponent(templateKey) {
  const Component = TEMPLATE_REGISTRY[templateKey];
  if (!Component) {
    throw new Error(
      `No registered component for template key "${templateKey}". ` +
        "Add it to src/pipeline3/templateRegistry.js."
    );
  }
  return Component;
}
