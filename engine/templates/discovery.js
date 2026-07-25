import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { isKnownContentKey } from "../contentKeys/registry.js";

const MANIFEST_FILENAME = "manifest.json";

/**
 * @typedef {Object} DiscoveryIssue
 * @property {string} manifestPath
 * @property {string} message
 */

/**
 * @typedef {Object} DiscoveryResult
 * @property {import("../../types.js").TemplateRegistry} registry
 * @property {Map<string, string[]>} families - family -> templateIds
 * @property {DiscoveryIssue[]} issues
 */

/**
 * Recursively scans `rootDir` for template folders. A template folder is any
 * directory containing a manifest.json. This means templates can be nested
 * arbitrarily, e.g.
 *
 *   templates/lists/basic/manifest.json
 *   templates/quote/pull-quote/manifest.json
 *   templates/image-comparison/side-by-side/manifest.json
 *   templates/lists/nested-group/ranked/manifest.json   <-- still discovered
 *
 * The template's `family` is derived as the path segment between rootDir and
 * the manifest's own folder, i.e. everything except the final folder (the
 * template's own name). `templateId` is `${family}/${manifest.id ?? folderName}`.
 *
 * @param {string} rootDir
 * @returns {Promise<DiscoveryResult>}
 */
export async function discoverTemplates(rootDir) {
  const registry = new Map();
  const families = new Map();
  const issues = [];

  const manifestPaths = await findManifests(rootDir);

  for (const manifestPath of manifestPaths) {
    try {
      const resolved = await loadManifest(rootDir, manifestPath);
      for (const issue of validateManifestShape(resolved)) {
        issues.push({ manifestPath, message: issue });
      }
      if (registry.has(resolved.templateId)) {
        issues.push({
          manifestPath,
          message: `Duplicate templateId "${resolved.templateId}" - a later manifest overwrote an earlier one.`,
        });
      }
      registry.set(resolved.templateId, resolved);
      const list = families.get(resolved.family) ?? [];
      list.push(resolved.templateId);
      families.set(resolved.family, list);
    } catch (err) {
      issues.push({ manifestPath, message: `Failed to load: ${err.message}` });
    }
  }

  return { registry, families, issues };
}

async function findManifests(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }

  const hasManifestHere = entries.some((e) => e.isFile() && e.name === MANIFEST_FILENAME);
  if (hasManifestHere) {
    found.push(path.join(dir, MANIFEST_FILENAME));
    // Do not descend further into a template's own folder (its structure
    // files live alongside the manifest, not more templates), but sibling
    // subfolders one level up are still walked normally by the caller.
    return found;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      const nested = await findManifests(path.join(dir, entry.name));
      found.push(...nested);
    }
  }
  return found;
}

async function loadManifest(rootDir, manifestPath) {
  const raw = await readFile(manifestPath, "utf-8");
  const manifest = JSON.parse(raw);

  const templateDir = path.dirname(manifestPath);
  const relFromRoot = path.relative(rootDir, templateDir); // e.g. "lists/basic" or "lists/nested-group/ranked"
  const segments = relFromRoot.split(path.sep).filter(Boolean);
  const folderName = segments[segments.length - 1] ?? "unknown";
  const family = segments.slice(0, -1).join("/") || folderName;

  const id = manifest.id ?? folderName;
  const templateId = `${family}/${id}`;

  // Verify every declared structure file actually exists on disk.
  for (const variation of manifest.variations ?? []) {
    const structurePath = path.join(templateDir, variation.structure);
    await stat(structurePath).catch(() => {
      throw new Error(`variation "${variation.id}" references missing structure file "${variation.structure}"`);
    });
  }

  return {
    ...manifest,
    id,
    family,
    templateId,
    dir: templateDir,
    manifestPath,
  };
}

function validateManifestShape(t) {
  const issues = [];
  if (!t.variations || t.variations.length === 0) {
    issues.push("manifest declares zero variations.");
  }
  if (!t.supportedContentKeys || Object.keys(t.supportedContentKeys).length === 0) {
    issues.push("manifest declares no supportedContentKeys.");
  }
  for (const key of Object.keys(t.supportedContentKeys ?? {})) {
    if (!isKnownContentKey(key)) {
      issues.push(`supportedContentKeys references unknown key "${key}" - not in the standardized content key registry.`);
    }
  }
  const ids = new Set();
  for (const v of t.variations ?? []) {
    if (ids.has(v.id)) issues.push(`duplicate variation id "${v.id}".`);
    ids.add(v.id);
  }
  return issues;
}
