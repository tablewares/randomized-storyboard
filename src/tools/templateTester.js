import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root - go up from src/tools to project root
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PRIMARY_TEMPLATE_ROOT = path.join(PROJECT_ROOT, "templates");
const SECONDARY_TEMPLATE_ROOT = path.join(PROJECT_ROOT, "templates-secondary");

console.log("DEBUG: PROJECT_ROOT =", PROJECT_ROOT);
console.log("DEBUG: PRIMARY_TEMPLATE_ROOT =", PRIMARY_TEMPLATE_ROOT);
console.log("DEBUG: PRIMARY_TEMPLATE_ROOT exists =", fs.existsSync(PRIMARY_TEMPLATE_ROOT));

// ============================================================================
// MANIFEST VALIDATION
// ============================================================================

function validateManifest(manifest, templateKey, templateDir) {
  const errors = [];
  const warnings = [];

  // Required fields
  const requiredFields = ["key", "description", "capacity", "keywords", "maxLayoutJitterPx", "assetSlots", "layoutVariants", "styleVariants"];
  for (const field of requiredFields) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Key must match template directory
  if (manifest.key !== templateKey) {
    errors.push(`Manifest key "${manifest.key}" does not match directory name "${templateKey}"`);
  }

  // Description
  if (manifest.description && typeof manifest.description !== "string") {
    errors.push("description must be a string");
  } else if (!manifest.description || manifest.description.trim().length === 0) {
    warnings.push("description is empty");
  }

  // Capacity
  if (manifest.capacity) {
    if (typeof manifest.capacity.minChars !== "number" || typeof manifest.capacity.maxChars !== "number") {
      errors.push("capacity.minChars and capacity.maxChars must be numbers");
    } else if (manifest.capacity.minChars > manifest.capacity.maxChars) {
      errors.push("capacity.minChars cannot exceed capacity.maxChars");
    }
  }

  // Keywords
  if (manifest.keywords) {
    if (!Array.isArray(manifest.keywords)) {
      errors.push("keywords must be an array");
    } else if (manifest.keywords.length === 0) {
      warnings.push("keywords array is empty - template may not match any scenes");
    } else {
      for (const kw of manifest.keywords) {
        if (typeof kw !== "string") {
          errors.push("All keywords must be strings");
          break;
        }
      }
    }
  }

  // Max layout jitter
  if (typeof manifest.maxLayoutJitterPx !== "number" || manifest.maxLayoutJitterPx < 0) {
    errors.push("maxLayoutJitterPx must be a non-negative number");
  }

  // Asset slots
  if (manifest.assetSlots) {
    if (typeof manifest.assetSlots !== "object" || Array.isArray(manifest.assetSlots)) {
      errors.push("assetSlots must be an object");
    } else {
      for (const [slotName, assetPath] of Object.entries(manifest.assetSlots)) {
        if (typeof assetPath !== "string") {
          errors.push(`assetSlots.${slotName}: asset path must be string`);
        } else if (assetPath.startsWith("assets/")) {
          // Check if asset file exists
          const assetFile = path.join(templateDir, assetPath);
          if (!fs.existsSync(assetFile)) {
            warnings.push(`assetSlots.${slotName}: referenced asset not found at ${assetFile}`);
          }
        }
      }
    }
  }

  // Layout variants
  if (manifest.layoutVariants) {
    if (!Array.isArray(manifest.layoutVariants)) {
      errors.push("layoutVariants must be an array");
    } else if (manifest.layoutVariants.length === 0) {
      errors.push("layoutVariants must have at least one variant");
    } else {
      const variantNames = new Set();
      for (let i = 0; i < manifest.layoutVariants.length; i++) {
        const variant = manifest.layoutVariants[i];
        if (!variant.name || typeof variant.name !== "string") {
          errors.push(`layoutVariants[${i}]: missing or invalid name`);
        } else if (variantNames.has(variant.name)) {
          errors.push(`layoutVariants: duplicate variant name "${variant.name}"`);
        } else {
          variantNames.add(variant.name);
        }

        if (!variant.boundingBoxes || typeof variant.boundingBoxes !== "object") {
          errors.push(`layoutVariants.${variant.name}: boundingBoxes must be an object`);
        } else {
          for (const [regionName, box] of Object.entries(variant.boundingBoxes)) {
            if (!box || typeof box !== "object") {
              errors.push(`layoutVariants.${variant.name}.boundingBoxes.${regionName}: must be an object`);
            } else {
              const requiredProps = ["x", "y", "w", "h"];
              for (const prop of requiredProps) {
                if (typeof box[prop] !== "number") {
                  errors.push(`layoutVariants.${variant.name}.boundingBoxes.${regionName}.${prop}: must be a number`);
                }
              }
              // Check bounds (1080x1920 canvas)
              if (box.x < 0 || box.y < 0 || box.w <= 0 || box.h <= 0) {
                warnings.push(`layoutVariants.${variant.name}.boundingBoxes.${regionName}: unusual bounds (x:${box.x}, y:${box.y}, w:${box.w}, h:${box.h})`);
              }
              if (box.x + box.w > 1080 || box.y + box.h > 1920) {
                warnings.push(`layoutVariants.${variant.name}.boundingBoxes.${regionName}: exceeds 1080x1920 canvas`);
              }
            }
          }
        }
      }
    }
  }

  // Style variants
  if (manifest.styleVariants) {
    if (!Array.isArray(manifest.styleVariants)) {
      errors.push("styleVariants must be an array");
    } else if (manifest.styleVariants.length === 0) {
      errors.push("styleVariants must have at least one variant");
    } else {
      const variantNames = new Set();
      for (let i = 0; i < manifest.styleVariants.length; i++) {
        const variant = manifest.styleVariants[i];
        if (!variant.name || typeof variant.name !== "string") {
          errors.push(`styleVariants[${i}]: missing or invalid name`);
        } else if (variantNames.has(variant.name)) {
          errors.push(`styleVariants: duplicate variant name "${variant.name}"`);
        } else {
          variantNames.add(variant.name);
        }

        if (variant.colors && typeof variant.colors !== "object") {
          errors.push(`styleVariants.${variant.name}.colors: must be an object`);
        }
        if (variant.fontFamily && typeof variant.fontFamily !== "string") {
          errors.push(`styleVariants.${variant.name}.fontFamily: must be a string`);
        }
        if (!variant.colors && !variant.fontFamily) {
          warnings.push(`styleVariants.${variant.name}: no colors or fontFamily defined`);
        }
      }
    }
  }

  return { errors, warnings };
}

// ============================================================================
// COMPONENT VALIDATION
// ============================================================================

function validateComponent(componentPath, templateKey) {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(componentPath)) {
    errors.push(`Component file not found: ${componentPath}`);
    return { errors, warnings };
  }

  const content = fs.readFileSync(componentPath, "utf-8");

  // Must be a React component (default export)
  if (!content.includes("export default")) {
    errors.push("Component must have a default export");
  }

  // Must import React
  if (!content.includes("import React")) {
    warnings.push("Component doesn't import React (required for JSX)");
  }

  // Must accept layout prop
  const hasLayoutParam = content.includes("layout") || content.includes("{ layout }") || content.includes("({ layout }");
  if (!hasLayoutParam) {
    warnings.push("Component doesn't appear to accept 'layout' prop - expected by SceneRenderer");
  }

  // Check for common template patterns
  if (!content.includes("boundingBoxes") && !content.includes("layout.boundingBoxes")) {
    warnings.push("Component doesn't reference boundingBoxes - layout positioning may not work");
  }

  if (!content.includes("assets") && !content.includes("layout.assets")) {
    warnings.push("Component doesn't reference layout.assets - asset slots may not render");
  }

  if (!content.includes("style") && !content.includes("layout.style")) {
    warnings.push("Component doesn't reference layout.style - style variants may not apply");
  }

  // Check for remotion imports (Img, AbsoluteFill, etc.)
  const hasRemotionImports = content.includes("from \"remotion\"") || content.includes("from 'remotion'");
  if (!hasRemotionImports) {
    warnings.push("No remotion imports found - component may not render in Remotion");
  }

  // Check for staticFile usage for local assets
  if (content.includes("assets.") && !content.includes("staticFile")) {
    warnings.push("Component references assets but doesn't use staticFile() - local assets may 404 during render");
  }

  return { errors, warnings };
}

// ============================================================================
// REGISTRY VALIDATION
// ============================================================================

function validateRegistry(templateKey) {
  const errors = [];
  const warnings = [];

  const registryPath = path.join(PROJECT_ROOT, "src/pipeline3/templateRegistry.js");
  if (!fs.existsSync(registryPath)) {
    errors.push("templateRegistry.js not found");
    return { errors, warnings };
  }

  const content = fs.readFileSync(registryPath, "utf-8");

  // Check if template is imported
  const importPattern = new RegExp(`import\\s+\\w+\\s+from\\s+["'].*/templates/${templateKey}/index\\.jsx["']`);
  if (!importPattern.test(content)) {
    errors.push(`Template "${templateKey}" not imported in templateRegistry.js`);
  }

  // Check if template is in TEMPLATE_REGISTRY - can be identifier or string key
  // For keys with hyphens: "image-panel":
  // For identifier keys: quote, _fallback:
  let registryPattern;
  if (templateKey.includes("-") || /[^a-zA-Z0-9_$]/.test(templateKey)) {
    // Must be string key
    registryPattern = new RegExp(`["']${templateKey}["']\\s*:`);
  } else {
    // Can be identifier or string
    registryPattern = new RegExp(`(?:["']${templateKey}["']|\\b${templateKey}\\b)\\s*:`);
  }
  if (!registryPattern.test(content)) {
    errors.push(`Template "${templateKey}" not registered in TEMPLATE_REGISTRY`);
  }

  return { errors, warnings };
}

// ============================================================================
// PIPELINE 2 HYDRATION VALIDATION
// ============================================================================

function validateHydrationCompatibility(manifest, templateKey) {
  const errors = [];
  const warnings = [];

  // Check that all assetSlots in manifest can be resolved by pipeline2/templating.js
  if (manifest.assetSlots) {
    for (const [slotName, assetPath] of Object.entries(manifest.assetSlots)) {
      if (typeof assetPath !== "string") {
        errors.push(`assetSlots.${slotName}: manifest asset path must be string`);
      }
    }
  }

  // Check layoutVariants have boundingBoxes for all regions
  if (manifest.layoutVariants) {
    const allRegions = new Set();
    for (const variant of manifest.layoutVariants) {
      if (variant.boundingBoxes) {
        for (const region of Object.keys(variant.boundingBoxes)) {
          allRegions.add(region);
        }
      }
    }
    if (allRegions.size === 0) {
      warnings.push("No bounding box regions defined in layoutVariants");
    }
  }

  // Check styleVariants have colors/fontFamily
  if (manifest.styleVariants) {
    for (const variant of manifest.styleVariants) {
      if (!variant.colors && !variant.fontFamily) {
        warnings.push(`styleVariants.${variant.name}: no colors or fontFamily defined`);
      }
    }
  }

  // Check capacity is compatible with text content
  if (manifest.capacity && manifest.capacity.maxChars < 50) {
    warnings.push(`capacity.maxChars is ${manifest.capacity.maxChars} - very restrictive for text content`);
  }

  return { errors, warnings };
}

// ============================================================================
// ASSET VALIDATION
// ============================================================================

function validateAssets(templateDir) {
  const errors = [];
  const warnings = [];

  const assetsDir = path.join(templateDir, "assets");
  if (!fs.existsSync(assetsDir)) {
    warnings.push("No assets/ directory found");
    return { errors, warnings };
  }

  const assetFiles = fs.readdirSync(assetsDir);
  if (assetFiles.length === 0) {
    warnings.push("assets/ directory is empty");
  }

  return { errors, warnings };
}

// ============================================================================
// MAIN TESTER
// ============================================================================

function discoverTemplates() {
  const templates = [];

  for (const root of [PRIMARY_TEMPLATE_ROOT, SECONDARY_TEMPLATE_ROOT]) {
    if (!fs.existsSync(root)) continue;

    const dirs = fs.readdirSync(root, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of dirs) {
      const templateDir = path.join(root, dir);
      const manifestPath = path.join(templateDir, "manifest.json");
      const componentPath = path.join(templateDir, "index.jsx");

      if (fs.existsSync(manifestPath)) {
        templates.push({
          key: dir,
          dir: templateDir,
          manifestPath,
          componentPath,
          root: root === PRIMARY_TEMPLATE_ROOT ? "primary" : "secondary",
        });
      }
    }
  }

  return templates;
}

function testTemplate(template) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing template: ${template.key} (${template.root})`);
  console.log(`${"=".repeat(60)}`);

  const allErrors = [];
  const allWarnings = [];

  // 1. Load and validate manifest
  console.log("\n📋 Validating manifest.json...");
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(template.manifestPath, "utf-8"));
    const { errors, warnings } = validateManifest(manifest, template.key, template.dir);
    allErrors.push(...errors.map(e => `  ❌ ${e}`));
    allWarnings.push(...warnings.map(w => `  ⚠️  ${w}`));
    if (errors.length === 0 && warnings.length === 0) {
      console.log("  ✅ Manifest valid");
    }
  } catch (e) {
    allErrors.push(`  ❌ Failed to parse manifest.json: ${e.message}`);
    return { errors: allErrors, warnings: allWarnings, passed: false };
  }

  // 2. Validate component
  console.log("\n⚛️  Validating component (index.jsx)...");
  const { errors: compErrors, warnings: compWarnings } = validateComponent(template.componentPath, template.key);
  allErrors.push(...compErrors.map(e => `  ❌ ${e}`));
  allWarnings.push(...compWarnings.map(w => `  ⚠️  ${w}`));
  if (compErrors.length === 0 && compWarnings.length === 0) {
    console.log("  ✅ Component valid");
  }

  // 3. Validate registry registration
  console.log("\n📦 Validating template registry registration...");
  const { errors: regErrors, warnings: regWarnings } = validateRegistry(template.key);
  allErrors.push(...regErrors.map(e => `  ❌ ${e}`));
  allWarnings.push(...regWarnings.map(w => `  ⚠️  ${w}`));
  if (regErrors.length === 0 && regWarnings.length === 0) {
    console.log("  ✅ Registry registration valid");
  }

  // 4. Validate pipeline 2 hydration compatibility
  console.log("\n🔗 Validating pipeline 2 hydration compatibility...");
  const { errors: hydErrors, warnings: hydWarnings } = validateHydrationCompatibility(manifest, template.key);
  allErrors.push(...hydErrors.map(e => `  ❌ ${e}`));
  allWarnings.push(...hydWarnings.map(w => `  ⚠️  ${w}`));
  if (hydErrors.length === 0 && hydWarnings.length === 0) {
    console.log("  ✅ Hydration compatible");
  }

  // 5. Validate assets
  console.log("\n📁 Validating assets...");
  const { errors: assetErrors, warnings: assetWarnings } = validateAssets(template.dir);
  allErrors.push(...assetErrors.map(e => `  ❌ ${e}`));
  allWarnings.push(...assetWarnings.map(w => `  ⚠️  ${w}`));
  if (assetErrors.length === 0 && assetWarnings.length === 0) {
    console.log("  ✅ Assets valid");
  }

  // Summary
  const passed = allErrors.length === 0;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULT: ${passed ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`  Errors: ${allErrors.length}`);
  console.log(`  Warnings: ${allWarnings.length}`);
  console.log(`${"=".repeat(60)}`);

  if (allErrors.length > 0) {
    console.log("\nErrors:");
    allErrors.forEach(e => console.log(e));
  }
  if (allWarnings.length > 0) {
    console.log("\nWarnings:");
    allWarnings.forEach(w => console.log(w));
  }

  return { errors: allErrors, warnings: allWarnings, passed, manifest };
}

function runTests(templateKey) {
  console.log("🧪 TEMPLATE TESTER");
  console.log("==================\n");

  const templates = discoverTemplates();
  console.log(`Discovered ${templates.length} template(s): ${templates.map(t => t.key).join(", ")}`);

  const toTest = templateKey === "--all"
    ? templates
    : templates.filter(t => t.key === templateKey);

  if (toTest.length === 0) {
    console.log(`\n❌ No template found matching: ${templateKey}`);
    console.log(`Available: ${templates.map(t => t.key).join(", ")}`);
    process.exit(1);
  }

  const results = [];
  for (const template of toTest) {
    const result = testTemplate(template);
    results.push({ template: template.key, ...result });
  }

  // Overall summary
  console.log("\n\n📊 SUMMARY");
  console.log("==========");
  const allPassed = results.every(r => r.passed);
  for (const r of results) {
    console.log(`${r.passed ? "✅" : "❌"} ${r.template}: ${r.errors.length} errors, ${r.warnings.length} warnings`);
  }
  console.log(`\nOverall: ${allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);

  if (!allPassed) {
    process.exit(1);
  }

  return results;
}

// CLI
const args = process.argv.slice(2);
const templateKey = args[0] || "--all";

runTests(templateKey);