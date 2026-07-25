import path from "node:path";
import fs from "node:fs/promises";
import { runStoryboardEngine } from "./orchestrator.js"; // adjust path to your module

async function main() {
  // Load configuration and input data
  const config = JSON.parse(await fs.readFile("./storyboard.config.json", "utf-8"));
  const storyboard = JSON.parse(await fs.readFile("./storyboard.json", "utf-8"));

  // Mock or real embedder instance (e.g., OpenAI, HuggingFace, or custom vector function)
  const embedder = {
    async embed(text) {
      // Replace with your actual embedding function if required
      return [/* vector embeddings */];
    }
  };

  // Assemble the `opts` object required by runStoryboardEngine
  const opts = {
    outputDir: path.resolve(config.outputDir),
    templatesRoot: path.resolve(config.templatesRoot),
    selectionThreshold: config.selectionThreshold,
    skipRender: config.skipRender,
    scoringWeights: config.scoringWeights,
    storyboard: storyboard,
    embedder: embedder
  };

  console.log("Starting Storyboard Engine...");
  
  try {
    const result = await runStoryboardEngine(opts);
    
    console.log("Engine execution complete!");
    console.log(`Discovered Template Families: ${result.templateFamilies.length}`);
    if (result.videoPath) {
      console.log(`Video rendered successfully to: ${result.videoPath}`);
    } else {
      console.log("Render skipped per configuration.");
    }
  } catch (error) {
    console.error("Error executing Storyboard Engine:", error);
  }
}

main();