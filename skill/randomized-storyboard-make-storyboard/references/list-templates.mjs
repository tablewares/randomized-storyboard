// Lists every discovered template in the randomized-storyboard catalog.
// Run from ANY cwd:
//   node ~/.hermes/skills/project/randomized-storyboard-make-storyboard/references/list-templates.mjs
//
// Resolves the project root from $RANDOMIZED_STORYBOARD_ROOT, falling back to
// /home/tablewares/random/randomized-storyboard. Prints one line per template:
//   <templateId>  [required: ...]  [optional: ...]  "description"
// Exit 0 on success, non-zero if discovery failed entirely.
//
// NOTE: ESM import specifiers are resolved relative to THIS file (which lives in
// the skill tree), so we CANNOT do a static `import from "../engine/..."` — that
// would land inside the skill folder. Instead we resolve the real engine/ path
// in the user's repo and dynamic-import it via a file:// URL.

import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot =
  process.env.RANDOMIZED_STORYBOARD_ROOT ||
  "/home/tablewares/random/randomized-storyboard";

const engineDir = path.join(projectRoot, "engine");
const discoveryUrl = pathToFileURL(path.join(engineDir, "templates/discovery.js")).href;

let discoverTemplates;
try {
  ({ discoverTemplates } = await import(discoveryUrl));
} catch (err) {
  console.error(`list-templates: could not import engine/templates/discovery.js at ${discoveryUrl}`);
  console.error(err);
  process.exit(1);
}

const templatesRoot = path.join(projectRoot, "templates");

try {
  const { registry, families, issues } = await discoverTemplates(templatesRoot);
  if (issues.length > 0) {
    console.error(`discovery issues (${issues.length}):`);
    for (const i of issues) console.error(`  - ${i.manifestPath}: ${i.message}`);
  }
  console.log(`templatesRoot: ${templatesRoot}`);
  console.log(`families (${families.size}): ${[...families.keys()].join(", ")}`);
  console.log(`templates (${registry.size}):`);
  const rows = [...registry.values()].sort((a, b) =>
    a.templateId < b.templateId ? -1 : a.templateId > b.templateId ? 1 : 0
  );
  for (const t of rows) {
    const required = Object.entries(t.supportedContentKeys ?? {})
      .filter(([, v]) => v?.required)
      .map(([k]) => k)
      .join(",");
    const optional = Object.entries(t.supportedContentKeys ?? {})
      .filter(([, v]) => !v?.required)
      .map(([k]) => k)
      .join(",");
    const reqStr = required ? `  req:${required}` : "";
    const optStr = optional ? `  opt:${optional}` : "";
    console.log(`  ${t.templateId}${reqStr}${optStr}  "${t.description ?? ""}"`);
  }
} catch (err) {
  console.error("list-templates failed:", err);
  process.exit(1);
}
