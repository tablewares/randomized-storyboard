#!/usr/bin/env node
/**
 * Template Validation Script for randomized-storyboard
 #!/usr/bin/env node
 /**
  * Template Validation Script
  * 
  * Validates all templates in the templates/ and templates-secondary/ directories
  * against the expected manifest schema and component structure.
  * 
  * The actual template schema used in this project:
  * - key, description, capacity (minChars, maxChars)
  * - keywords (array), maxLayoutJitterPx (number)
  * - assetSlots (object), layoutVariants (array), styleVariants (array)
  * 
  * Usage: node references/validate-templates.js
  */

 import fs from "node:fs";
 import path from "node:path";
 import { execSync } from "node:child_process";

 const PROJECT_ROOT = "/home/tablewares/random/randomized-storyboard";
 const PRIMARY_ROOT = path.join(PROJECT_ROOT, "templates");
 const SECONDARY_ROOT = path.join(PROJECT_ROOT, "templates-secondary");

 // Expected manifest fields for THIS project's schema
 const REQUIRED_MANIFEST_FIELDS = ["key", "description", "capacity"];
 const REQUIRED_CAPACITY_FIELDS = ["minChars", "maxChars"];

 function discoverTemplates(rootDir) {
   const templates = [];

   function walk(dir, family = "") {
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

         const uniqueKey = family ? family + "-" + manifest.key : manifest.key;

         templates.push({
           family: family || entry.name,
           name: entry.name,
           uniqueKey,
           manifest,
           manifestPath,
           componentPath
         });
       }

       // Always recurse into subdirectories (template family folders)
       const newFamily = family ? family + "-" + entry.name : entry.name;
       walk(tplDir, newFamily);
     }
   }

   walk(rootDir);
   return templates;
 }

 function validateManifest(manifest, manifestPath) {
   const errors = [];

   // Check required fields
   for (const field of REQUIRED_MANIFEST_FIELDS) {
     if (!manifest[field]) {
       errors.push(`Missing required field: ${field}`);
     }
   }

   // Capacity sub-fields
   if (manifest.capacity) {
     for (const field of REQUIRED_CAPACITY_FIELDS) {
       if (manifest.capacity[field] === undefined) {
         errors.push(`Missing capacity.${field}`);
       }
     }

     // Validate capacity values
     if (typeof manifest.capacity.minChars !== "number" || manifest.capacity.minChars < 0) {
       errors.push("capacity.minChars must be a non-negative number");
     }
     if (typeof manifest.capacity.maxChars !== "number" || manifest.capacity.maxChars < 0) {
       errors.push("capacity.maxChars must be a non-negative number");
     }
     if (manifest.capacity.minChars > manifest.capacity.maxChars) {
       errors.push("capacity.minChars cannot exceed maxChars");
     }
   } else {
     errors.push("Missing required field: capacity");
   }

   // Validate optional but recommended fields
   if (manifest.keywords && !Array.isArray(manifest.keywords)) {
     errors.push("keywords must be an array");
   }

   if (manifest.layoutVariants && !Array.isArray(manifest.layoutVariants)) {
     errors.push("layoutVariants must be an array");
   }

   if (manifest.styleVariants && !Array.isArray(manifest.styleVariants)) {
     errors.push("styleVariants must be an array");
   }

   if (manifest.assetSlots && typeof manifest.assetSlots !== "object") {
     errors.push("assetSlots must be an object");
   }

   return errors;
 }

 function validateComponent(componentPath) {
   const content = fs.readFileSync(componentPath, "utf-8");
   const errors = [];

   // Check for default export
   if (!content.includes("export default") && !content.includes("export default function")) {
     errors.push("Component must have a default export");
   }

   // Check for layout prop usage (this project's convention)
   if (!content.includes("layout")) {
     console.warn(`  ⚠️  Component doesn't reference 'layout' prop (expected pattern)`);
   }

   // Check for useCurrentFrame or useVideoConfig (Remotion animation)
   if (!content.includes("useCurrentFrame") && !content.includes("useVideoConfig")) {
     console.warn(`  ⚠️  Component doesn't use useCurrentFrame or useVideoConfig (may be static)`);
   }

   // Check for AbsoluteFill or similar Remotion components
   if (!content.includes("AbsoluteFill") && !content.includes("from \"remotion\"")) {
     console.warn(`  ⚠️  No Remotion imports detected`);
   }

   return errors;
 }

 function runValidation() {
   console.log("🔍 Validating templates...\n");

   const allTemplates = [
     ...discoverTemplates(PRIMARY_ROOT),
     ...discoverTemplates(SECONDARY_ROOT)
   ];

   console.log(`Found ${allTemplates.length} template(s):\n`);

   let totalErrors = 0;
   let validCount = 0;

   for (const tpl of allTemplates) {
     console.log(`📁 ${tpl.family}/${tpl.name} (key: ${tpl.uniqueKey})`);

     // Validate manifest
     const manifestErrors = validateManifest(tpl.manifest, tpl.manifestPath);
     if (manifestErrors.length > 0) {
       for (const err of manifestErrors) {
         console.error(`  ❌ ${err}`);
       }
       totalErrors += manifestErrors.length;
     }

     // Validate component
     const componentErrors = validateComponent(tpl.componentPath);
     if (componentErrors.length > 0) {
       for (const err of componentErrors) {
         console.error(`  ❌ ${err}`);
       }
       totalErrors += componentErrors.length;
     }

     if (manifestErrors.length === 0 && componentErrors.length === 0) {
       console.log(`  ✅ Valid`);
       validCount++;
     }

     console.log("");
   }

   // Regenerate registry
   console.log("📦 Regenerating template registry...");
   try {
     execSync("node src/pipeline3/populateRegistry.js --regenerate", { 
       cwd: PROJECT_ROOT, 
       stdio: "inherit" 
     });
   } catch (e) {
     console.error("❌ Registry regeneration failed");
     totalErrors++;
   }

   // Remotion check - use the correct entry point with registerRoot
     console.log("\n🔍 Running Remotion type-check...");
     try {
       // Check compositions using the correct entry point
       execSync("npx remotion compositions src/pipeline3/index.jsx", { 
         cwd: PROJECT_ROOT, 
         stdio: "inherit" 
       });
       console.log("✅ Remotion compositions check passed");
     } catch (e) {
       console.error("❌ Remotion compositions check failed");
       totalErrors++;
     }

   // Summary
   console.log("\n" + "=".repeat(50));
   console.log(`SUMMARY: ${validCount}/${allTemplates.length} templates valid`);
   console.log(`Total errors: ${totalErrors}`);
   console.log("=".repeat(50));

   if (totalErrors > 0) {
     process.exit(1);
   }
 }

 runValidation();