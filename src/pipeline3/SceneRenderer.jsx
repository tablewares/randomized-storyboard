import React from "react";
import { resolveTemplateComponent } from "./templateRegistry.js";

/**
 * Thin adapter between a hydrated layout payload (pipeline 2 output) and a
 * template's own component contract. Every template component receives
 * `{ layout }` (the full hydrated payload) plus any pass-through extras.
 */
export default function SceneRenderer({ hydratedScene, extraProps }) {
  const TemplateComponent = resolveTemplateComponent(hydratedScene.templateKey);
  return <TemplateComponent layout={hydratedScene} {...extraProps} />;
}
