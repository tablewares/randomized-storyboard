/**
 * Remotion's bundler (webpack) needs statically analyzable imports to
 * include each template's component in the render bundle. Because the
 * scoring engine can in principle discover new template folders at runtime,
 * every template that should be renderable MUST be registered here as well
 * -- discovery and rendering are deliberately decoupled.
 *
 * Add one line per template folder under /templates or /templates-secondary.
 */
import QuoteTemplate from "../../templates/quote/index.jsx";
import ImagePanelTemplate from "../../templates/image-panel/index.jsx";
import FallbackTemplate from "../../templates/_fallback/index.jsx";

export const TEMPLATE_REGISTRY = {
  quote: QuoteTemplate,
  "image-panel": ImagePanelTemplate,
  _fallback: FallbackTemplate,
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
