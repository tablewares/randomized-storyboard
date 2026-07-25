#!/usr/bin/env node
/**
 * Full Template Loop - Create, Validate, Register, Test
 * 
 * Usage: node references/template-loop.js [--create] [--validate] [--test]
 * 
 * This script orchestrates the complete template lifecycle:
 * 1. Create templates from definitions (--create)
 * 2. Validate all templates (--validate)
 * 3. Register in Remotion registry
 * 4. Run Remotion type-check
 * 5. Test render with sample storyboards (--test)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = "/home/tablewares/random/randomized-storyboard";
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, "templates");
const STORYBOARDS_DIR = path.join(PROJECT_ROOT, "storyboards");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "output");

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ============================================================
// TEMPLATE DEFINITIONS
// Add new templates here - they'll be created in nested structure
// ============================================================

const TEMPLATE_DEFINITIONS = [
  // Example template - uncomment and modify to create real templates
  /*
  {
    family: "anthropic-templates",
    name: "side-by-side",
    manifest: {
      key: "side-by-side",
      description: "Side-by-side comparison with two columns",
      capacity: { minChars: 200, maxChars: 800 },
      slots: ["leftTitle", "rightTitle", "leftItems", "rightItems", "verdict"],
      styleOverrides: {
        container: { display: "flex", flexDirection: "column" },
        row: { display: "flex", gap: "20px" },
        column: { flex: 1 }
      }
    },
    componentCode: `import React from "react";
import { useVideoConfig } from "remotion";

export default function SideBySide({ 
  leftTitle, rightTitle, leftItems, rightItems, verdict, 
  styleOverrides = {} 
}) {
  const { width, height, fps } = useVideoConfig();
  
  return (
    <div style={{ width, height, padding: "40px", ...styleOverrides.container }}>
      <h1 style={styleOverrides.title}>{leftTitle} vs {rightTitle}</h1>
      <div style={{ display: "flex", gap: "40px", ...styleOverrides.row }}>
        <div style={{ flex: 1, ...styleOverrides.column }}>
          <h2>Left</h2>
          <ul>
            {leftItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
        <div style={{ flex: 1, ...styleOverrides.column }}>
          <h2>Right</h2>
          <ul>
            {rightItems.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>
      <div style={styleOverrides.verdict}>{verdict}</div>
    </div>
  );
}`
  }
  */
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function run(cmd, options = {}) {
  try {
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: "inherit", ...options });
    return true;
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

function createTemplates() {
  console.log("📝 Creating templates...\n");
  
  let created = 0;
  for (const def of TEMPLATE_DEFINITIONS) {
    const templateDir = path.join(TEMPLATES_ROOT, def.family, def.name);
    fs.mkdirSync(templateDir, { recursive: true });
    
    fs.writeFileSync(
      path.join(templateDir, "manifest.json"),
      JSON.stringify(def.manifest, null, 2)
    );
    
    fs.writeFileSync(
      path.join(templateDir, "index.jsx"),
      def.componentCode
    );
    
    console.log(`  ✅ Created: ${def.family}/${def.name} (key: ${def.manifest.key})`);
    created++;
  }
  
  console.log(`\nCreated ${created} template(s).\n`);
  return created > 0;
}

function validateAll() {
  console.log("🔍 Validating all templates...\n");

  const roots = [TEMPLATES_ROOT, path.join(PROJECT_ROOT, "templates-secondary")];
  let total = 0, valid = 0, errors = 0;

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    function walk(dir, prefix = "") {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const tplDir = path.join(dir, entry.name);
        const manifestPath = path.join(tplDir, "manifest.json");
        const componentPath = path.join(tplDir, "index.jsx");

        if (fs.existsSync(manifestPath) && fs.existsSync(componentPath)) {
          total++;
          console.log(`  Checking: ${prefix}${entry.name}`);

          let isValid = true;

          // Validate manifest (matches actual project schema)
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

            if (!manifest.key) { console.error("    ❌ Missing key"); isValid = false; }
            if (manifest.capacity === undefined || manifest.capacity.minChars === undefined || manifest.capacity.maxChars === undefined) { 
              console.error("    ❌ Missing capacity bounds"); isValid = false; 
            }
            // Check optional but recommended fields
            if (manifest.keywords && !Array.isArray(manifest.keywords)) { 
              console.error("    ❌ Keywords must be array"); isValid = false; 
            }
            if (manifest.layoutVariants && !Array.isArray(manifest.layoutVariants)) { 
              console.error("    ❌ LayoutVariants must be array"); isValid = false; 
            }
            if (manifest.styleVariants && !Array.isArray(manifest.styleVariants)) { 
              console.error("    ❌ StyleVariants must be array"); isValid = false; 
            }
          } catch (e) {
            console.error(`    ❌ Invalid JSON: ${e.message}`);
            isValid = false;
          }

          // Validate component
          const componentCode = fs.readFileSync(componentPath, "utf-8");
          if (!componentCode.includes("export default")) {
            console.error("    ❌ No default export");
            isValid = false;
          }

          // Check for layout prop usage (this project's convention)
          if (!componentCode.includes("layout")) {
            console.warn("    ⚠️ Component doesn't reference 'layout' prop");
          }

          if (isValid) {
            console.log("    ✅ Valid");
            valid++;
          } else {
            errors++;
          }
        }

        walk(tplDir, prefix + entry.name + "-");
      }
    }

    walk(root);
  }

  console.log(`\n📊 Validation: ${valid}/${total} valid, ${errors} errors\n`);
  return errors === 0;
}

function regenerateRegistry() {
  console.log("📦 Regenerating template registry...\n");
  return run("node src/pipeline3/populateRegistry.js --regenerate");
}

function listTemplates() {
  console.log("📋 Discovered templates:\n");
  run("node src/pipeline3/populateRegistry.js --list");
}

function remotionCheck() {
  console.log("\n🔍 Running Remotion type-check...\n");
  try {
    // Check compositions using the correct entry point (index.jsx has registerRoot)
    execSync("npx remotion compositions src/pipeline3/index.jsx", { 
      cwd: PROJECT_ROOT, 
      stdio: "inherit" 
    });
    console.log("✅ Remotion compositions check passed");
    return true;
  } catch (e) {
    console.error("❌ Remotion compositions check failed");
    return false;
  }
}

function testRender() {
  console.log("🎬 Testing renders...\n");

  // Find test storyboards
  const storyboards = fs.readdirSync(STORYBOARDS_DIR)
    .filter(f => f.endsWith(".storyboard.json") || f.endsWith(".json"))
    .map(f => path.join(STORYBOARDS_DIR, f));

  if (storyboards.length === 0) {
    console.log("  No storyboards found in storyboards/");
    return false;
  }

  let success = 0;
  for (const sb of storyboards) {
    const name = path.basename(sb, ".json").replace(".storyboard", "");
    const output = path.join(OUTPUT_DIR, `${name}-test.mp4`);

    console.log(`  Rendering ${name}...`);
    if (run(`node src/pipeline3/render.js --storyboard ${sb} --output ${output}`)) {
      success++;
    }
  }

  console.log(`\n✅ ${success}/${storyboards.length} test renders succeeded\n`);
  return success > 0;
}

// ============================================================
// MAIN
// ============================================================

const args = process.argv.slice(2);
const doCreate = args.includes("--create") || args.includes("-c");
const doValidate = args.includes("--validate") || args.includes("-v");
const doTest = args.includes("--test") || args.includes("-t");
const doAll = !doCreate && !doValidate && !doTest; // Default: all

console.log("🚀 Randomized Storyboard Template Loop\n");

let success = true;

if (doAll || doCreate) {
  const created = createTemplates();
  if (!created && doAll) {
    console.log("No templates defined in TEMPLATE_DEFINITIONS. Skipping creation.\n");
  }
}

if (doAll || doValidate) {
  const valid = validateAll();
  success = success && valid;
}

if (doAll || doValidate) {
  const regenerated = regenerateRegistry();
  success = success && regenerated;
}

if (doAll || doValidate) {
  listTemplates();
}

if (doAll || doValidate) {
  const checked = remotionCheck();
  success = success && checked;
}

if (doAll || doTest) {
  const tested = testRender();
  success = success && tested;
}

console.log("=".repeat(50));
if (success) {
  console.log("✨ ALL CHECKS PASSED");
  process.exit(0);
} else {
  console.log("❌ SOME CHECKS FAILED");
  process.exit(1);
}