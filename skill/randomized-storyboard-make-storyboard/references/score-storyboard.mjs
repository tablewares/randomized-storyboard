// Scores a storyboard.json against the randomized-storyboard engine using the
// REAL engine/ modules (discovery + pipeline1 + pipeline2 + preparePipeline3).
// Uses the WPM fallback timing path (no TTS server, no Whisper, no Remotion) so
// it runs anywhere Node 18+ is installed.
//
// Usage:
//   node score-storyboard.mjs <path/to/storyboard.json>
//
// Exits 0 on a successful pipeline-1+2 pass-through (warnings are OK — they
// are surfaced but do NOT fail the run). Exits non-zero only when the pipelines
// themselves throw (missing template, malformed storyboard, etc.).
//
// NOTE: engine source lives in the user's repo (`<projectRoot>/engine/`), not
// under the skill tree. We dynamic-import the real modules via file:// URLs.

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot =
  process.env.RANDOMIZED_STORYBOARD_ROOT ||
  "/home/tablewares/random/randomized-storyboard";

const engineDir = path.join(projectRoot, "engine");
const importEngine = (rel) => import(pathToFileURL(path.join(engineDir, rel)).href);

let discoverTemplates, runPipeline1, runPipeline2, preparePipeline3;
try {
  ({
    discoverTemplates,
  } = await importEngine("templates/discovery.js"));
  ({ runPipeline1 } = await importEngine("pipeline1/index.js"));
  ({ runPipeline2 } = await importEngine("pipeline2/index.js"));
  ({ preparePipeline3 } = await importEngine("pipeline3/index.js"));
} catch (err) {
  console.error(`score-storyboard: could not import engine modules from ${engineDir}`);
  console.error(err);
  process.exit(1);
}

function fail(msg, err) {
  console.error(`score-storyboard: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

const [, , storyboardPath] = process.argv;
if (!storyboardPath) fail("missing argument: <storyboard.json path>");

let storyboard;
try {
  storyboard = JSON.parse(await fs.readFile(storyboardPath, "utf-8"));
} catch (e) {
  fail(`could not parse storyboard at "${storyboardPath}"`, e);
}
if (!storyboard.scenes || storyboard.scenes.length === 0) {
  fail("storyboard has no scenes.");
}
if (!storyboard.id) {
  console.warn("score-storyboard: WARNING — storyboard has no `id`; render output will be `undefined.mp4`.");
}
if (!storyboard.voice) {
  console.warn("score-storyboard: WARNING — `voice` missing; pipeline 1 TTS adapter may fail at render time (WPM fallback path is used here, so this run is unaffected).");
}

const configPath = path.join(projectRoot, "storyboard.config.json");
let cfg = {};
try {
  cfg = JSON.parse(await fs.readFile(configPath, "utf-8"));
} catch {
  console.warn(`score-storyboard: no storyboard.config.json at ${configPath} — using defaults.`);
}
const templatesRoot = path.resolve(projectRoot, cfg.templatesRoot || "./templates");
const selectionThreshold = cfg.selectionThreshold ?? 0.4;

let registry, families, issues;
try {
  ({ registry, families, issues } = await discoverTemplates(templatesRoot));
} catch (e) {
  fail(`discoverTemplates threw for ${templatesRoot}`, e);
}

if (issues.length > 0) {
  console.warn(`score-storyboard: ${issues.length} discovery issues (catalog-wide):`);
  for (const i of issues)
    console.warn(`  - ${path.relative(projectRoot, i.manifestPath)}: ${i.message}`);
}
if (registry.size === 0) fail(`no templates discovered under ${templatesRoot}`);

console.log(`families: ${[...families.keys()].join(", ")} (${families.size} families)`);
console.log(`templates registered: ${registry.size}`);
console.log(`selectionThreshold: ${selectionThreshold}`);

// Force the WPM fallback in synthesizeAndAlign by NOT passing workDir.
const voicecfg = { ...(cfg.voicecfg ?? {}), workDir: undefined };

// Only forward cfg.scoringWeights if it actually uses the engine's weight names.
// storyboard.config.json on this project currently has a stale {semanticMatch,
// pacingMatch, styleMatch} shape from a different pipeline — passing those to
// runPipeline1 zeroes every score (keyCoverage*undefined = NaN). Validate and
// fall back to the engine default if the shape doesn't match.
const ENGINE_WEIGHT_KEYS = ["keyCoverage", "charFit", "keyword", "familyHint"];
let scoringWeights = undefined;
if (cfg.scoringWeights && typeof cfg.scoringWeights === "object") {
  const has = (k) => Object.prototype.hasOwnProperty.call(cfg.scoringWeights, k);
  if (ENGINE_WEIGHT_KEYS.every(has)) scoringWeights = cfg.scoringWeights;
  else
    console.warn(
      `score-storyboard: ignoring storyboard.config.json scoringWeights — shape doesn't match engine's ${ENGINE_WEIGHT_KEYS.join("/")}. Using engine defaults.`
    );
}

let pipeline1;
try {
  pipeline1 = await runPipeline1(storyboard, {
    templateRegistry: registry,
    scoringWeights,
    selectionThreshold,
    voicecfg,
  });
} catch (e) {
  fail("runPipeline1 threw", e);
}

console.log("\npipeline 1 — template selections:");
for (const sel of pipeline1.templateSelections) {
  const w = pipeline1.warnings.find((x) => x.sceneId === sel.sceneId);
  const flag = w
    ? `  ❗ below threshold (${sel.score.toFixed(2)} < ${w.threshold}) — ${w.reason.slice(0, 120)}…`
    : "";
  console.log(
    `  ${sel.sceneId} -> ${sel.templateId}  score=${sel.score.toFixed(2)}  transitionIn=${sel.transitionIn}${flag}`
  );
}

let pipeline2;
try {
  pipeline2 = await runPipeline2(storyboard, pipeline1, { templateRegistry: registry });
} catch (e) {
  fail("runPipeline2 threw", e);
}

console.log("\npipeline 2 — hydration:");
let totalWarnings = 0;
for (const s of pipeline2.hydratedScenes) {
  totalWarnings += s.contentWarnings?.length ?? 0;
  const tail = (s.contentWarnings?.length ?? 0) > 0 ? `  contentWarnings: ${s.contentWarnings.join("; ")}` : "";
  console.log(
    `  ${s.sceneId}  variation=${s.variationId}  structure=${path.basename(s.structurePath)}${tail}`
  );
}

let renderInputSummary = "";
// preparePipeline3 calls `path.isAbsolute(audioPath)` unconditionally — the WPM
// fallback path in pipeline 1's voiceover.js sets audioPath to null (no real TTS).
// Skip the pipeline-3 step entirely in that case; it's only informative here.
if (pipeline1.audioPath == null) {
  renderInputSummary = "(skipped — pipeline 1 audioPath is null; WPM fallback used, no real audio)";
} else {
  try {
    const { renderInput } = await preparePipeline3(
      storyboard,
      { ...pipeline1, templateRegistry: registry },
      pipeline2,
      cfg.cfg ?? { render: false }
    );
    renderInputSummary = `fps=${renderInput.fps} totalDurationSec=${renderInput.totalDurationSec.toFixed(2)} scenes=${renderInput.scenes.length} transitions=${renderInput.transitions.length} sfx=${renderInput.sfx.length}`;
  } catch (e) {
    fail("preparePipeline3 threw", e);
  }
}

console.log(`\nrender-input: ${renderInputSummary}`);
console.log(
  `\nscenes: ${pipeline2.hydratedScenes.length} | warnings: ${pipeline1.warnings.length + totalWarnings}`
);
console.log("score-storyboard: OK");
process.exit(0);
