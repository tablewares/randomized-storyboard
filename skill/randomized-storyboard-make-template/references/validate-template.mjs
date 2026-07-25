// Validates one or every template in the randomized-storyboard catalog against
// the real engine/templates/discovery.js rules + content-key registry, and
// best-effort dynamic-imports each structure jsx to catch syntax/import errors
// (no Remotion runtime needed for the import check itself).
//
// Usage:
//   node validate-template.mjs                          # scan entire catalog
//   node validate-template.mjs templates/lists/basic/    # scan one template folder
//
// Exit 0 if every discovered template passed, exit 1 if ANY had issues.

import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot =
  process.env.RANDOMIZED_STORYBOARD_ROOT ||
  "/home/tablewares/random/randomized-storyboard";

const engineDir = path.join(projectRoot, "engine");
const importEngine = (rel) => import(pathToFileURL(path.join(engineDir, rel)).href);

let discoverTemplates, listContentKeys;
try {
  ({ discoverTemplates } = await importEngine("templates/discovery.js"));
  ({ listContentKeys } = await importEngine("contentKeys/registry.js"));
} catch (err) {
  console.error(`validate-template: could not import engine modules from ${engineDir}`);
  console.error(err);
  process.exit(1);
}

const knownKeys = new Set(listContentKeys().map((k) => k.key));

const [, , targetFolderArg] = process.argv;
const templatesRoot = path.join(projectRoot, "templates");

// Discover all templates first (engine does it rooted at templatesRoot).
let registry, families, issues;
try {
  ({ registry, families, issues } = await discoverTemplates(templatesRoot));
} catch (err) {
  console.error("validate-template: discoverTemplates threw:", err);
  process.exit(1);
}

// Filter to the target folder if one was passed.
let targets = [...registry.values()];
if (targetFolderArg) {
  const absTarget = path.resolve(targetFolderArg);
  targets = targets.filter((t) =>
    path.resolve(t.dir) === absTarget ||
    path.resolve(t.dir).startsWith(absTarget + path.sep)
  );
  if (targets.length === 0) {
    console.error(`validate-template: no discovered template found in folder "${targetFolderArg}".`);
    console.error("(Discovery only finds folders containing a manifest.json.)");
    process.exit(1);
  }
}

let allIssues = [...issues.filter((i) => !targetFolderArg || targets.some((t) => t.manifestPath === i.manifestPath))];
let perTemplateExtra = [];

for (const t of targets) {
  const perTemplate = [];
  // Discovery already covers: zero variations, no supportedContentKeys, unknown
  // content keys, duplicate variation ids, missing structure files, duplicate
  // templateId. Add a few more checks here that discovery doesn't enforce.

  // (a) structure jsx syntax check — best-effort advisory only.
  // The engine renders these via Remotion's esbuild bundler, which transpiles
  // JSX. Node's stock ESM loader CANNOT import `.jsx` files (no transpiler), so
  // a vanilla dynamic import will fail on the EXTENSION even when the file is
  // perfectly valid. We surface those failure messages as WARNINGS, not as
  // template-failing issues — only flag a real failure if the message looks
  // like a real syntax error (not just "Unknown file extension .jsx").
  for (const v of t.variations ?? []) {
    const structurePath = path.join(t.dir, v.structure);
    const importUrl = pathToFileURL(structurePath).href;
    try {
      const mod = await import(importUrl);
      if (!mod?.default || typeof mod.default !== "function") {
        perTemplate.push(`variation "${v.id}": structure ${v.structure} has no default React component export`);
      }
    } catch (err) {
      const msg = String(err.message?.split("\n")[0] ?? err);
      if (/Unknown file extension "\.jsx?"/i.test(msg) || /ERR_UNKNOWN_FILE_EXTENSION/.test(err.code ?? "")) {
        // Expected in stock Node — Remotion's bundler will handle the JSX at render.
        // Skip silently.
      } else if (/Cannot find module|ERR_MODULE_NOT_FOUND/.test(msg) || err.code === "ERR_MODULE_NOT_FOUND") {
        // Discovery already enforces file existence; skip silently here.
      } else {
        // Something else — likely a genuine syntax error or bad import that
        // Remotion's esbuild will ALSO reject. Surface as a real failure.
        perTemplate.push(`variation "${v.id}": structure "${v.structure}" seems broken: ${msg}`);
      }
    }
  }

  // (b) keywords array should be non-empty for good scoring matches
  if (!t.keywords || t.keywords.length === 0) {
    perTemplate.push("manifest declares no keywords[] — scoring against scene.keywords[] will score 0 on the keyword signal. Add at least 3 keywords.");
  }

  // (c) required content keys sanity: redundant double-check that every
  // required key is in the content-key registry (discovery already enforces
  // this; we just surface it per-template).
  for (const [key, sup] of Object.entries(t.supportedContentKeys ?? {})) {
    if (sup?.required && !knownKeys.has(key)) {
      perTemplate.push(`required content key "${key}" is not in the registry (will also be flagged by discovery).`);
    }
  }

  if (perTemplate.length > 0) {
    perTemplateExtra.push(...perTemplate.map((m) => ({ manifestPath: t.manifestPath, message: m })));
  }
}

// Tally and print per-template status
const targetManifestPaths = new Set(targets.map((t) => t.manifestPath));
const failedManifestPaths = new Set(
  [...issues, ...perTemplateExtra]
    .filter((i) => !targetFolderArg || targetManifestPaths.has(i.manifestPath))
    .map((i) => i.manifestPath)
);

console.log(`validate-template: scanned ${targets.length} template(s) under ${templatesRoot}`);
for (const t of targets) {
  const ok = !failedManifestPaths.has(t.manifestPath);
  const mark = ok ? "OK" : "FAIL";
  const required = Object.entries(t.supportedContentKeys ?? {})
    .filter(([, v]) => v?.required).map(([k]) => k).join(",");
  console.log(`  [${mark}] ${t.templateId}  req:${required || "(none)"}  variations:${(t.variations ?? []).map(v => v.id).join(",")}`);
}

// Print the issues that apply to the scanned set
const relevantIssues = [...issues, ...perTemplateExtra].filter(
  (i) => !targetFolderArg || targetManifestPaths.has(i.manifestPath)
);
if (relevantIssues.length > 0) {
  console.log(`\nissues (${relevantIssues.length}):`);
  for (const i of relevantIssues) {
    console.log(`  - ${path.relative(projectRoot, i.manifestPath)}: ${i.message}`);
  }
} else {
  console.log("\nissues: 0");
}

if (failedManifestPaths.size === 0) {
  console.log("\nvalidate-template: OK");
  process.exit(0);
} else {
  console.error(`\nvalidate-template: FAILED — ${failedManifestPaths.size} of ${targets.length} templates had issues.`);
  process.exit(1);
}
