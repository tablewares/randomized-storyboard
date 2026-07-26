// ============================================================================
// Shared type documentation (JSDoc, no TypeScript). This is the contract
// between agents (who write storyboard JSON), template authors (manifest +
// jsx), and the three pipelines. Nothing here is executed - it's here so
// editors can still offer autocomplete/hints via `@type`/`@param` JSDoc
// annotations elsewhere in the engine.
// ============================================================================

/**
 * @typedef {string|number|string[]|ContentImage|undefined} ContentValue
 */

/**
 * @typedef {Object} ContentImage
 * @property {string} url - remote url or local path, resolved by the template's renderer
 * @property {string} [alt]
 * @property {boolean} [isStatic] - set by pipeline 2's resolveMediaContent:
 *        true when `url` has been rewritten to a staticFile()-safe basename
 *        (e.g. "media/foo.png") and the source file staged under public/media/.
 *        false (or absent) for remote http(s)/data URLs that renderers should
 *        use verbatim. Structures switch on this via engine/pipeline3/Media.jsx.
 */

/**
 * The standardized, agent-facing set of content keys. Agents composing a
 * storyboard should only use keys from this list (see
 * engine/contentKeys/registry.js for the authoritative, extensible list and
 * validation logic).
 * @typedef {"title"|"subtitle"|"description"|"author"|"number"|"label"|"value"|
 *   "quote"|"source"|"caption"|"date"|"items"|"tags"|"image"|"images"|"icon"|"video"} StandardContentKey
 */

/**
 * @typedef {Object.<StandardContentKey, ContentValue>} StoryboardContent
 */

/**
 * Standardized style override surface every template variation understands.
 * @typedef {Object} StandardStyleVars
 * @property {Object} [palette]
 * @property {string} [palette.background]
 * @property {string} [palette.foreground]
 * @property {string} [palette.primary]
 * @property {string} [palette.secondary]
 * @property {string} [palette.accent]
 * @property {string} [palette.muted]
 * @property {Object} [font]
 * @property {string} [font.heading]
 * @property {string} [font.body]
 * @property {number} [font.scale] - multiplier applied to base font sizes
 * @property {Object} [spacing]
 * @property {number} [spacing.scale] - multiplier applied to base spacing unit
 * @property {number} [radius]
 */

/**
 * @typedef {Object} VoiceConfig
 * @property {string} provider
 * @property {string} voiceId
 * @property {number} [speed]
 */

/**
 * @typedef {Object} StoryboardScene
 * @property {string} id
 * @property {string} voiceover
 * @property {string} [family] - optional hint restricting selection to a template family (e.g. "lists")
 * @property {string} [templateId] - optional hint pinning selection to one exact templateId, skips scoring
 * @property {StoryboardContent} content
 * @property {string[]} [keywords] - free-text keywords used for keyword/embedding matching against manifests
 * @property {StandardStyleVars} [styleOverrides]
 */

/**
 * @typedef {Object} Storyboard
 * @property {string} id
 * @property {string|number} seed - master seed; all randomization in pipelines 1-3 derives from this
 * @property {StoryboardScene[]} scenes
 * @property {VoiceConfig} voice
 * @property {StandardStyleVars} [globalStyle]
 * @property {{path: string, volume?: number}} [music]
 * @property {string} [sfxDir] - directory of .mp3/.wav sfx files, one is picked per scene end
 * @property {number} [fps] - defaults to 30
 */

// ---------------------------------------------------------------------------
// Template manifest types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ContentKeySupport
 * @property {boolean} [required]
 * @property {number} [maxChars] - for string-like keys
 * @property {number} [maxItems] - for array-like keys (e.g. "items")
 */

/**
 * @typedef {Object} TemplateVariation
 * @property {string} id
 * @property {string} structure - path to the jsx structure file, relative to the template's folder
 * @property {string} [animation] - named animation preset implemented by the structure file
 * @property {StandardStyleVars} [style]
 * @property {number} [weight] - relative selection weight within the template, default 1
 */

/**
 * @typedef {Object} TemplateManifest
 * @property {string} id - unique within family, defaults to folder name
 * @property {string} family - set by discovery, but may be declared for clarity
 * @property {string} [description]
 * @property {string[]} [keywords]
 * @property {Object.<StandardContentKey, ContentKeySupport>} supportedContentKeys
 * @property {TemplateVariation[]} variations
 */

/**
 * A manifest resolved to its absolute location on disk.
 * @typedef {TemplateManifest & {templateId: string, dir: string, manifestPath: string}} ResolvedTemplate
 */

/**
 * @typedef {Map<string, ResolvedTemplate>} TemplateRegistry
 */

// ---------------------------------------------------------------------------
// Pipeline outputs
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SceneTiming
 * @property {string} sceneId
 * @property {number} startSec
 * @property {number} endSec
 */

/**
 * @typedef {Object} TemplateSelectionWarning
 * @property {string} sceneId
 * @property {string} bestTemplateId
 * @property {number} score
 * @property {number} threshold
 * @property {string} reason
 */

/**
 * @typedef {Object} TemplateSelection
 * @property {string} sceneId
 * @property {string} templateId
 * @property {string} family
 * @property {number} score
 * @property {Object.<string, number>} scoreBreakdown
 * @property {string} transitionIn
 * @property {string} transitionOut
 */

/**
 * @typedef {Object} Pipeline1Output
 * @property {string} audioPath
 * @property {SceneTiming[]} sceneTimings
 * @property {TemplateSelection[]} templateSelections
 * @property {TemplateSelectionWarning[]} warnings
 */

/**
 * @typedef {Object} HydratedScene
 * @property {string} sceneId
 * @property {string} family
 * @property {string} templateId
 * @property {string} variationId
 * @property {string} structurePath - absolute path
 * @property {string} [animation]
 * @property {StoryboardContent} content
 * @property {StandardStyleVars} style
 * @property {SceneTiming} timing
 * @property {string[]} contentWarnings - truncation etc.
 */

/**
 * @typedef {Object} Pipeline2Output
 * @property {HydratedScene[]} hydratedScenes
 */

/**
 * @typedef {Object} SfxPlacement
 * @property {string} sceneId
 * @property {number} atSec - scene end
 * @property {string} sfxPath
 */

/**
 * @typedef {Object} RenderInput
 * @property {number} fps
 * @property {number} totalDurationSec
 * @property {string} audioPath
 * @property {{path: string, volume?: number}} [music]
 * @property {SfxPlacement[]} sfx
 * @property {HydratedScene[]} scenes
 * @property {{betweenSceneId: string, andSceneId: string, type: string}[]} transitions
 */

export {}; // marks this file as an ES module
