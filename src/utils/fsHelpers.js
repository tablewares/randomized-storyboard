import fs from "node:fs";
import path from "node:path";

/**
 * A valid template folder must contain manifest.json, an index entry
 * (index.jsx / index.tsx / index.js), and an /assets directory.
 */
export function isValidTemplateFolder(folderPath) {
  const hasManifest = fs.existsSync(path.join(folderPath, "manifest.json"));
  const hasIndex = ["index.jsx", "index.tsx", "index.js"].some((f) =>
    fs.existsSync(path.join(folderPath, f))
  );
  const hasAssets = fs.existsSync(path.join(folderPath, "assets"));
  return hasManifest && hasIndex && hasAssets;
}

export function resolveIndexEntry(folderPath) {
  for (const f of ["index.jsx", "index.tsx", "index.js"]) {
    const full = path.join(folderPath, f);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

/**
 * Recursively loads every valid template folder under a root directory,
 * parsing each manifest.json. Invalid folders (missing required members)
 * are skipped silently -- they are not templates, just stray files.
 * 
 * Supports nested template family folders: templates can be organized in
 * hierarchies like templates/family-name/template-name/
 * 
 * Nested templates get keys prefixed with their folder path (e.g., "anthropic-templates-stat-highlight")
 * to ensure uniqueness and allow multiple versions of the same template.
 */
export function loadTemplateManifests(rootDir) {
  if (!fs.existsSync(rootDir)) return [];

  const templates = [];

  function walk(dir, prefix = "") {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const folderPath = path.join(dir, entry.name);

      // Check if this directory is a valid template
      if (isValidTemplateFolder(folderPath)) {
        const manifestPath = path.join(folderPath, "manifest.json");
        let manifest;
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        } catch (err) {
          console.warn(`[templates] Failed to parse manifest at ${manifestPath}: ${err.message}`);
          continue;
        }

        // Create a unique key by prefixing with the folder path (excluding root)
        // This allows nested templates with same name to coexist
        const uniqueKey = prefix ? prefix + "-" + (manifest.key || entry.name) : (manifest.key || entry.name);

        templates.push({
          key: uniqueKey,
          originalKey: manifest.key || entry.name,
          folderPath,
          indexEntry: resolveIndexEntry(folderPath),
          assetsDir: path.join(folderPath, "assets"),
          manifest,
        });
      }

      // Always recurse into subdirectories (template family folders)
      const newPrefix = prefix ? prefix + "-" + entry.name : entry.name;
      walk(folderPath, newPrefix);
    }
  }

  walk(rootDir);
  return templates;
}

export function appendJsonLog(filePath, records) {
  let existing = [];
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }
  }
  const merged = [...existing, ...records];
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
