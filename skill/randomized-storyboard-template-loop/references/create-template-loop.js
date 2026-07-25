#!/usr/bin/env node
/**
 * Template Creation Loop for randomized-storyboard
 * 
 * Usage: node references/create-template-loop.js
 * 
 * Creates templates in nested folder structure (family -> template)
 * and runs validation/registration automatically.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = "/home/tablewares/random/randomized-storyboard";
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, "templates");

/**
 * Create a new template in the nested structure
 * @param {string} family - Template family (e.g., "anthropic-templates")
 * @param {string} name - Template name (e.g., "comparison-v2")
 * @param {object} manifest - Manifest object
 * @param {string} componentCode - React component source code
 */
function createTemplate(family, name, manifest, componentCode) {
  const templateDir = path.join(TEMPLATES_ROOT, family, name);
  fs.mkdirSync(templateDir, { recursive: true });
  
  // Write manifest.json
  fs.writeFileSync(
    path.join(templateDir, "manifest.json"), 
    JSON.stringify(manifest, null, 2)
  );
  
  // Write index.jsx
  fs.writeFileSync(path.join(templateDir, "index.jsx"), componentCode);
  
  console.log(`✅ Created template: ${family}/${name}`);
  return templateDir;
}

/**
 * Run validation and registration
 */
function validateAndRegister() {
  console.log("\n📦 Regenerating template registry...");
  execSync("node src/pipeline3/populateRegistry.js --regenerate", { 
    cwd: PROJECT_ROOT, 
    stdio: "inherit" 
  });
  
  console.log("\n📋 Listing discovered templates...");
  execSync("node src/pipeline3/populateRegistry.js --list", { 
    cwd: PROJECT_ROOT, 
    stdio: "inherit" 
  });
  
  console.log("\n🔍 Running Remotion type-check...");
  try {
    execSync("npx remotion check src/pipeline3/Composition.jsx", { 
      cwd: PROJECT_ROOT, 
      stdio: "inherit" 
    });
    console.log("✅ Remotion check passed");
  } catch (e) {
    console.error("❌ Remotion check failed");
  }
}

/**
 * Test render a template with a sample storyboard
 * @param {string} templateKey - Registered template key (e.g., "anthropic-templates-comparison")
 * @param {string} storyboardPath - Path to test storyboard
 */
function testRender(templateKey, storyboardPath) {
  const outputPath = `output/${templateKey.replace(/[^a-z0-9-]/gi, "-")}-test.mp4`;
  console.log(`\n🎬 Testing render for ${templateKey}...`);
  
  try {
    execSync(`node src/pipeline3/render.js ${storyboardPath} ${outputPath}`, { 
      cwd: PROJECT_ROOT, 
      stdio: "inherit" 
    });
    console.log(`✅ Render test passed: ${outputPath}`);
  } catch (e) {
    console.error(`❌ Render test failed for ${templateKey}`);
  }
}

// ============================================================
// TEMPLATE DEFINITIONS - Add your templates here
// ============================================================

const TEMPLATES_TO_CREATE = [
  // Example: Add a new template to anthropic-templates family
  // {
  //   family: "anthropic-templates",
  //   name: "new-template-type",
  //   manifest: {
  //     key: "new-template-type",
  //     description: "Description of what this template does",
  //     capacity: { minChars: 100, maxChars: 500 },
  //     slots: ["title", "content", "cta"],
  //     styleOverrides: {}
  //   },
  //   componentCode: `import React from "react";
  // import { useVideoConfig } from "remotion";
  // 
  // export default function NewTemplateType({ title, content, cta, styleOverrides = {} }) {
  //   const { width, height } = useVideoConfig();
  //   return (
  //     <div style={{ width, height, ...styleOverrides.container }}>
  //       <h1 style={styleOverrides.title}>{title}</h1>
  //       <p style={styleOverrides.content}>{content}</p>
  //       <button style={styleOverrides.cta}>{cta}</button>
  //     </div>
  //   );
  // }`
  // },
];

// ============================================================
// EXECUTION
// ============================================================

console.log("🚀 Starting template creation loop...\n");

for (const t of TEMPLATES_TO_CREATE) {
  createTemplate(t.family, t.name, t.manifest, t.componentCode);
}

if (TEMPLATES_TO_CREATE.length > 0) {
  validateAndRegister();
  
  // Optional: Test render each new template
  for (const t of TEMPLATES_TO_CREATE) {
    const registryKey = `${t.family}-${t.manifest.key}`;
    // You'd need a test storyboard for each template
    // testRender(registryKey, "storyboards/test-storyboard.json");
  }
} else {
  console.log("No templates defined in TEMPLATES_TO_CREATE array.");
  console.log("Edit this file and add templates to the array, then run again.");
  console.log("\nRunning validation only...\n");
  validateAndRegister();
}

console.log("\n✨ Template loop complete!");