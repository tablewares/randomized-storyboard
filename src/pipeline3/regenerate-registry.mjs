import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Regenerates the Remotion template registry file based on available template directories.
 * Supports nested template family folders (recursive discovery).
 * Nested templates get keys prefixed with their folder path (e.g., "anthropic-templates-stat-highlight").
 *
 * @param {Object} [options]
 * @param {string[]} [options.templateRoots] - Array of template root folder paths.
 * @param {string} [options.outputPath] - Path where templateRegistry.js should be saved.
 * @param {boolean} [options.silent=false] - Suppress console logs if true.
 */
export function generateTemplateRegistry(options = {}) {
  const defaultRoots = [
    path.join(__dirname, "..", "..", "templates"),
    path.join(__dirname, "..", "..", "templates-secondary")
  ];

  const templateRoots = options.templateRoots || defaultRoots;
  const outputPath = options.outputPath || path.join(__dirname, "templateRegistry.js");
  const silent = options.silent ?? false;

  /**
   * Recursively discovers templates inside a root directory.
   * A template folder must contain both manifest.json and index.jsx.
   * Template family folders can contain nested template folders recursively.
   */
  function discoverTemplates(rootDir) {
    const templates = [];

    function walk(dir, prefix = "") {
      if (!fs.existsSync(dir)) return;

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const tplDir = path.join(dir, entry.name);
        const manifestPath = path.join(tplDir, "manifest.json");
        const componentPath = path.join(tplDir, "index.jsx");

        // Check if this directory is a template (has both manifest.json and index.jsx)
        if (fs.existsSync(manifestPath) && fs.existsSync(componentPath)) {
          let manifest;
          try {
            manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          } catch (e) {
            continue;
          }

          if (!manifest.key) continue;

          // Create a unique key by prefixing with the folder path (excluding root)
          // This allows nested templates with same name to coexist
          const uniqueKey = prefix ? prefix + "-" + manifest.key : manifest.key;

          // Calculate path relative to where the output file will live
          const outputDir = path.dirname(outputPath);
          let relComponentPath = path.relative(outputDir, componentPath).replace(/\\/g, "/");
          if (!relComponentPath.startsWith(".")) {
            relComponentPath = "./" + relComponentPath;
          }

          templates.push({ key: uniqueKey, originalKey: manifest.key, componentPath: relComponentPath, manifest });
        }

        // Always recurse into subdirectories (template family folders)
        const newPrefix = prefix ? prefix + "-" + entry.name : entry.name;
        walk(tplDir, newPrefix);
      }
    }

    walk(rootDir);
    return templates;
  }

  // Gather templates across all roots
  const allTemplates = templateRoots.flatMap(discoverTemplates);

  // Sort with fallback first, then alphabetical
  allTemplates.sort((a, b) => {
    if (a.key === "_fallback") return -1;
    if (b.key === "_fallback") return 1;
    return a.key.localeCompare(b.key);
  });

  // Helper to turn template keys into valid JavaScript identifier variable names
  const getVarName = (key) => key.replace(/[^a-zA-Z0-9_$]/g, "") + "Template";

  const imports = allTemplates
    .map(tpl => `import ${getVarName(tpl.key)} from "${tpl.componentPath}";`)
    .join("\n");

  const registryEntries = allTemplates
    .map(tpl => `  "${tpl.key}": ${getVarName(tpl.key)},`)
    .join("\n");

  const content = `/**
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
${imports}

export const TEMPLATE_REGISTRY = {
${registryEntries}
};

export function resolveTemplateComponent(templateKey) {
  const Component = TEMPLATE_REGISTRY[templateKey];
  if (!Component) {
    throw new Error(
      \`No registered component for template key "\${templateKey}". \` +
        "Add it to src/pipeline3/templateRegistry.js."
    );
  }
  return Component;
}
`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf-8");

  if (!silent) {
    console.log("[templateRegistry] Regenerated " + outputPath);
    console.log("[templateRegistry] Registered " + allTemplates.length + " templates");
    for (const t of allTemplates) {
      console.log("  - " + t.key + (t.key !== t.originalKey ? " (was " + t.originalKey + ")" : ""));
    }
  }

  return allTemplates;
}
