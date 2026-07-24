import path from "node:path";
import { createSceneRng, rngPick, rngRange } from "./seededRandom.js";

const URL_PATTERN = /^https?:\/\//i;

/**
 * Resolves an asset reference into an absolute URL/path usable by
 * <Img /> / <OffthreadVideo /> in pipeline 3.
 *
 * Resolution order:
 *   1. Scene-provided remote asset (scene.media.url) if it's a valid http(s) URL.
 *   2. Local asset declared in the template manifest, resolved relative to
 *      the template's /assets directory.
 */
function resolveAssetUrl(scene, template, assetKey, manifestAssetPath) {
  const sceneOverride = scene.media && scene.media[assetKey];

  if (sceneOverride && URL_PATTERN.test(sceneOverride)) {
    return { url: sceneOverride, source: "remote" };
  }

  if (manifestAssetPath) {
    const absolutePath = path.join(template.assetsDir, path.basename(manifestAssetPath));
    // Remotion serves local files through its public-dir mechanism, which
    // needs a path relative to the project root (consumed via staticFile()
    // in the browser-side template component) rather than an absolute
    // filesystem path -- an absolute path 404s against the render server.
    const relativePath = path.relative(process.cwd(), absolutePath);
    return { url: relativePath, source: "local" };
  }

  return { url: null, source: "none" };
}

/**
 * Applies a small deterministic jitter to a bounding box, bounded so it can
 * never leave the composition canvas. Uses ONLY the scene-scoped rng.
 */
function jitterBoundingBox(box, rng, maxJitterPx = 12) {
  const dx = rngRange(rng, -maxJitterPx, maxJitterPx);
  const dy = rngRange(rng, -maxJitterPx, maxJitterPx);
  return {
    ...box,
    x: Math.round(box.x + dx),
    y: Math.round(box.y + dy),
  };
}

/**
 * Hydrates a single matched scene into a fully resolved layout payload that
 * pipeline 3 can feed straight into Remotion components as props.
 *
 * @param {Object} scene   A scene from matchScenesToTemplates(), includes
 *                         `matchedTemplate`, timing fields, `sceneIndex`.
 * @returns {Object} resolvedLayout
 */
export function hydrateScene(scene) {
  const rng = createSceneRng(scene.sceneIndex);
  const { manifest, key } = scene.matchedTemplate;

  // 1. Deterministically pick a layout + style variant for this scene.
  const layoutVariants = manifest.layoutVariants || [
    { name: "default", boundingBoxes: {} },
  ];
  const styleVariants = manifest.styleVariants || [
    { name: "default", colors: {}, fontFamily: manifest.defaultFontFamily || "Inter" },
  ];

  const chosenLayout = rngPick(rng, layoutVariants);
  const chosenStyle = rngPick(rng, styleVariants);

  // 2. Resolve bounding boxes, applying a bounded deterministic jitter so
  //    repeated scenes of the same template don't look mechanically identical.
  const resolvedBoundingBoxes = Object.fromEntries(
    Object.entries(chosenLayout.boundingBoxes || {}).map(([regionName, box]) => [
      regionName,
      jitterBoundingBox(box, rng, manifest.maxLayoutJitterPx ?? 12),
    ])
  );

  // 3. Merge style: manifest variant defaults <- scene-level style overrides.
  const resolvedStyle = {
    ...chosenStyle,
    ...(scene.styleOverrides || {}),
  };

  // 4. Resolve every declared asset slot to a concrete URL/path.
  const assetSlots = manifest.assetSlots || {};
  const resolvedAssets = Object.fromEntries(
    Object.entries(assetSlots).map(([assetKey, manifestAssetPath]) => [
      assetKey,
      resolveAssetUrl(scene, scene.matchedTemplate, assetKey, manifestAssetPath),
    ])
  );

  // Collect all dynamic content fields from the scene (everything except known metadata fields)
  const METADATA_FIELDS = new Set([
    "id", "sceneIndex", "type", "text", "startFrame", "endFrame", "durationInFrames",
    "fps", "embedding", "keywords", "media", "styleOverrides", "matchedTemplate",
    "matchScore", "matchBreakdown", "matchSource"
  ]);

  const dynamicContent = {};
  for (const [k, v] of Object.entries(scene)) {
    if (!METADATA_FIELDS.has(k) && v !== undefined) {
      dynamicContent[k] = v;
    }
  }

  return {
    sceneId: scene.id,
    sceneIndex: scene.sceneIndex,
    templateKey: key,
    templateIndexEntry: scene.matchedTemplate.indexEntry,
    startFrame: scene.startFrame,
    endFrame: scene.endFrame,
    durationInFrames: scene.durationInFrames,
    fps: scene.fps,
    text: scene.text,
    layoutVariant: chosenLayout.name,
    styleVariant: chosenStyle.name,
    boundingBoxes: resolvedBoundingBoxes,
    style: resolvedStyle,
    assets: resolvedAssets,
    matchSource: scene.matchSource,
    matchScore: scene.matchScore,
    // deterministic seed string, exposed for debugging / reproducibility
    seed: `${scene.sceneIndex}`,
    // Dynamic content fields (subtitle, attribution, title, etc.) passed through to template
    content: dynamicContent,
  };
}

/** Hydrates every scene returned by matchScenesToTemplates(). */
export function hydrateAllScenes(matchedScenes) {
  return matchedScenes.map(hydrateScene);
}
